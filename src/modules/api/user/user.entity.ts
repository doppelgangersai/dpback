import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { PasswordTransformer } from './password.transformer';
import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';

@Entity({
  name: 'users',
})
export class User {
  @ApiResponseProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ required: false, example: 'John Doe' })
  @Column({ length: 255, nullable: true })
  fullName: string;

  @Column({ length: 255 })
  email: string;

  @ApiProperty({ required: false, example: 'https://example.com/avatar.jpg' })
  @Column({ length: 255, nullable: true })
  avatar: string;

  @Column({
    name: 'password',
    length: 255,
    transformer: new PasswordTransformer(),
    nullable: true,
  })
  password: string;

  @Column({ nullable: true })
  googleId: string;

  @Column({ nullable: true, select: false })
  googleAccessToken: string;

  @Column({ nullable: true })
  appleId: string;

  @Column({ nullable: true, select: false })
  appleAccessToken: string;

  toJSON() {
    const { password, ...self } = this;
    return { ...self, avatar: avatarTransformer(self.avatar) };
  }
}

export class UserFillableFields {
  email: string;
  fullName: string;
  password: string;
}


const avatarTransformer = (avatar?: string) => {
  return avatar ? avatar.includes('http') ? avatar : `${process.env.APP_URL}/uploads/${avatar}` : null;
}