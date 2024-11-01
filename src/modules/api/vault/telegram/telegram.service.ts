import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TelegramClient, sessions, Api } from 'telegram';
import { ConfigService } from '../../../config';
import { UserService } from '../../user';
import { VaultEmitter } from '../vault.emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { TELEGRAM_UPLOADED_EVENT } from '../../../../core/constants/event-emitter.constants';
import {
  TELEGRAM_API_HASH,
  TELEGRAM_API_ID,
} from '../../../../core/constants/environment.constants';

const { StringSession } = sessions;

@Injectable()
export class TelegramService {
  private apiId: number;
  private apiHash: string;
  private clients: { [phone: string]: TelegramClient } = {};
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private vaultEmitter: VaultEmitter,
  ) {
    this.apiId = parseInt(this.configService.get<string>(TELEGRAM_API_ID), 10);
    this.apiHash = this.configService.get<string>(TELEGRAM_API_HASH);
  }

  private createClient(
    phone: string,
    sessionString: string = '',
  ): TelegramClient {
    const client = new TelegramClient(
      new StringSession(sessionString),
      this.apiId,
      this.apiHash,
      {
        connectionRetries: 5,
      },
    );
    this.clients[phone] = client;
    return client;
  }

  async sendAuthCode(phone: string): Promise<{ phoneCodeHash: string }> {
    if (this.clients[phone]) {
      await this.removeClient(phone);
    }

    const client = this.createClient(phone);
    await client.connect();

    const result = await client.sendCode(
      { apiId: this.apiId, apiHash: this.apiHash },
      phone,
    );

    return { phoneCodeHash: result.phoneCodeHash };
  }

  async completeAuth(
    userId: number,
    code: string,
    phone: string,
    phoneCodeHash: string,
    password?: string,
  ): Promise<string> {
    console.log({
      code,
      phone,
      phoneCodeHash,
      password,
    });

    const client = this.clients[phone];
    if (!client) {
      throw new BadRequestException('Phone number not found');
    }

    try {
      console.log('Trying to sign in with code');

      const signInParams = {
        phoneNumber: phone,
        phoneCodeHash: phoneCodeHash,
        phoneCode: code,
      };

      console.log(signInParams);

      await client.invoke(new Api.auth.SignIn(signInParams));
    } catch (err) {
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED' && password) {
        console.log('Trying to sign in with password');
        await client.signInWithPassword(
          {
            apiId: this.apiId,
            apiHash: this.apiHash,
          },
          {
            password: async () => password,
            onError: (err) => {
              throw err;
            },
          },
        );
      } else {
        throw new BadRequestException(err?.message as string);
      }
    }

    const sessionString = `${client.session.save()}`;

    this.removeClient(phone);
    await this.userService.update(userId, {
      telegramAuthSession: sessionString,
    });

    await this.vaultEmitter.emitTelegramConnected(userId);

    return sessionString;
  }

  @OnEvent(TELEGRAM_UPLOADED_EVENT)
  async parseChats(userId: number): Promise<string[]> {
    const user = await this.userService.get(userId);
    if (!user.telegramAuthSession) {
      return;
    }
    const client = this.createClient('parse', user.telegramAuthSession);
    await client.connect();

    const dialogs = await client.getDialogs();
    const chats = [];

    const sleep = (n) =>
      new Promise((resolve) => setTimeout(resolve, n * 1000));

    let msgn = 0;
    for (const dialog of dialogs) {
      const messages = await client.iterMessages(dialog.id, { reverse: true });

      for await (const message of messages) {
        if (message.out && message.message) {
          const chatName = dialog.title || 'Unknown Chat/User';
          const formattedMessage = `To ${chatName}: ${message.message}`;
          msgn = msgn + 1;
          console.log(msgn, formattedMessage);
          chats.push(formattedMessage);

          if (msgn % 100 === 0) {
            break;
          }
        }
      }

      await sleep(5);
    }

    await client.disconnect();

    this.removeClient('parse');
    return chats;
  }

  private async removeClient(phone: string) {
    const client = this.clients[phone];
    if (client) {
      try {
        await client.disconnect();
        this.logger.log(`Client for phone ${phone} disconnected successfully.`);
      } catch (error) {
        this.logger.warn(
          `Error during disconnect for phone ${phone}: ${error.message}`,
        );
      } finally {
        delete this.clients[phone];
        this.logger.log(`Client for phone ${phone} removed from cache.`);
      }
    } else {
      this.logger.warn(`No client found for phone ${phone} to disconnect.`);
    }
  }
}
