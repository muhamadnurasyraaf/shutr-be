import { SetMetadata } from '@nestjs/common';

export enum UserType {
  Creator = 'Creator',
  Customer = 'Customer',
}

export const USER_TYPE_KEY = 'userType';
export const UserTypeS = (type: UserType) => SetMetadata(USER_TYPE_KEY, type);
