import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { getUniqueStrings } from '../../../utils/unique';

@Injectable()
export class AIService {
  constructor(private readonly openAIService: OpenAIService) {}

  async getProfileDescription(
    personalInfo: { [key: string]: string },
    posts: string[],
    comments: string[],
    reelsComments: string[],
    inbox: string[],
  ): Promise<string> {
    // Constructing a detailed prompt from the parsed data
    const prompt = this.createPrompt(
      personalInfo,
      getUniqueStrings(posts, 5, 0.7),
      getUniqueStrings(comments, 5, 0.7),
      getUniqueStrings(reelsComments, 5, 0.7),
      getUniqueStrings(inbox, 5, 0.4),
    );
    return this.openAIService.getResponse(prompt);
  }

  private createPrompt(
    personalInfo: { [key: string]: string },
    posts: string[],
    comments: string[],
    reelsComments: string[],
    inbox: string[],
  ): string {
    const infoString = Object.entries(personalInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const postsString = posts.join('\n');
    const commentsString = comments.join('\n');
    const reelsCommentsString = reelsComments.join('\n');
    const inboxString = inbox.join('\n');

    return `Generate a comprehensive profile description using the following information:
Personal Information:
${infoString}

Top Posts:
${postsString}

Top Comments:
${commentsString}

Top Reels Comments:
${reelsCommentsString}

Top Inbox Messages:
${inboxString}

Please provide a detailed summary and analysis based on the above data.
Be careful with sensitive information and make sure the output is suitable for public consumption.
Result should be an instruction for users digital twin chatbot.
`;
  }
}