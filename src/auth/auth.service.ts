import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateGoogleUser(googleAuthDto: GoogleAuthDto): Promise<User> {
    const { email, name, image, googleId } = googleAuthDto;

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update user if googleId is not set
      if (!user.googleId && googleId) {
        user = await this.prisma.user.update({
          where: { email },
          data: { googleId, name, image },
        });
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          image,
          googleId,
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
      },
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }
}
