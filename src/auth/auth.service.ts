import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async validateGoogleUser(googleAuthDto: GoogleAuthDto): Promise<User> {
    const { idToken, type } = googleAuthDto;

    const ticket = await this.googleClient.verifyIdToken({
      idToken: idToken,
      audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid Google ID token');
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      throw new UnauthorizedException('Email not provided by Google');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update user if googleId is not set
      if (!user.googleId && googleId) {
        user = await this.prisma.user.update({
          where: { email },
          data: { googleId, name, image: picture },
        });
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          image: picture,
          googleId,
          type,
        },
      });
    }

    return user;
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        type: user.type,
      },
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }
}
