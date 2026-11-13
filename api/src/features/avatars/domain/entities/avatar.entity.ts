export const ALLOWED_AVATAR_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type AvatarMimeType = (typeof ALLOWED_AVATAR_MIMES)[number];

export interface AvatarProps {
  id: string;
  mimeType: AvatarMimeType;
  content: Buffer;
  createdAt?: Date;
}

export class AvatarEntity {
  readonly id: string;
  readonly mimeType: AvatarMimeType;
  readonly content: Buffer;
  readonly createdAt?: Date;

  constructor(props: AvatarProps) {
    this.id = props.id;
    this.mimeType = props.mimeType;
    this.content = props.content;
    this.createdAt = props.createdAt;
  }

  static create(props: AvatarProps): AvatarEntity {
    return new AvatarEntity(props);
  }
}
