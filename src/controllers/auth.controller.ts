import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../config/supabase';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

export class AuthController {
  async register(req: Request, res: Response) {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      fullName: z.string().min(3),
    });

    const { email, password, fullName } = schema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 10);

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password_hash: passwordHash,
          full_name: fullName,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: 'Error creating user' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' },
    );

    return res.json({ token });
  }

  async login(req: Request, res: Response) {
    const schema = z.object({
      email: z.string().email(),
      password: z.string(),
    });

    const { email, password } = schema.parse(req.body);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' },
    );

    return res.json({ token });
  }

  async forgotPassword(req: Request, res: Response) {
    const schema = z.object({
      email: z.string().email(),
    });
  
    const { email } = schema.parse(req.body);
  
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
  
    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }
  
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
  
    await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires,
      })
      .eq('id', user.id);
  
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  
    // URL de reset que redireciona para a página de atualização de senha
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `Clique <a href="${resetUrl}">aqui</a> para redefinir sua senha.`,
    });
  
    return res.json({ message: 'Password reset email sent' });
  }
  
  

  async resetPassword(req: Request, res: Response) {
    const schema = z.object({
      token: z.string(),
      password: z.string().min(6),
    });

    const { token, password } = schema.parse(req.body);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('reset_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    if (new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ message: 'Token expired' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null,
      })
      .eq('id', user.id);

    return res.json({ message: 'Password updated successfully' });
  }

  async googleLogin(req: Request, res: Response) {
    const { code } = req.body; // Recebe o código de autorização do frontend

    try {
      
      // Troca o código de autorização por um token de acesso
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI, // URI de redirecionamento configurada no Google Cloud Console
      });

      // Verifica o token de acesso
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ message: 'Invalid token' });
      }

      // Verifica se o usuário já existe no banco de dados
      let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', payload.email)
        .single();

      // Se o usuário não existir, cria um novo usuário
      if (!user) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([
            {
              email: payload.email,
              full_name: payload.name || '',
              google_id: payload.sub,
              password_hash: crypto.randomBytes(32).toString('hex'), // Senha aleatória, já que o usuário está logando com Google
            },
          ])
          .select()
          .single();

        if (createError) {
          return res.status(500).json({ message: 'Error creating user' });
        }

        user = newUser;
      }

      if (!code || typeof code !== 'string') {
        return res
          .status(400)
          .json({ message: 'Missing or invalid authorization code' });
      }

      // Gera um token JWT para o usuário
      const jwtToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '1d' },
      );

      return res.json({ token: jwtToken });
    } catch (error) {
      console.error('Erro no login com Google:', error);
      const err = error as Error; // Converte 'error' para o tipo Error
      return res.status(500).json({ message: 'Login with Google failed', error: err.message });
  }
  
  }
}
