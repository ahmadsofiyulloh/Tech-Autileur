export type OperatorShellAffiliateProfile = {
  id: string;
  profileName: string;
  avatarUrl: string | null;
};

export type OperatorShellContext = {
  currentAffiliateProfile: OperatorShellAffiliateProfile | null;
};
