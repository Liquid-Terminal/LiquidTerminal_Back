export interface Project {
  id: number;
  title: string;
  desc: string;
  logo: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  createdAt: Date;
}

export interface CreateProjectDto {
  title: string;
  desc: string;
  logo: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
} 