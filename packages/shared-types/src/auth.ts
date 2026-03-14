export interface LinkuSessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

export interface LinkuSession {
  user: LinkuSessionUser;
  expires: string;
}

export interface GoogleAuthState {
  nonce: string;
  redirectTo?: string;
}
