export type Message = {
  role: 'user' | 'model';
  content: string;
  id?: string;
  createdAt?: Date;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
};
