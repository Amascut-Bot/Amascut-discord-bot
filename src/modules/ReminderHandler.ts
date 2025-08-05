import Bot from '../Bot';
import * as cron from 'node-cron';
import { TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getChannels } from '../GuildSpecifics';

interface ReminderData {
    messageIds: { [channelId: string]: string };
}

export default class ReminderHandler {
    private client: Bot;
    private reminderDataPath: string;
    private reminderData: ReminderData = { messageIds: {} };

    constructor(client: Bot) {
        this.client = client;
        this.reminderDataPath = path.join(process.cwd(), 'reminder-data.json');
        this.loadReminderData();
    }

    public startReminders() {
        cron.schedule('0 * * * *', () => this.sendHourlyReminders());
        this.client.logger.log({ 
            message: 'Voice channel reminder system started',
            handler: this.constructor.name 
        }, true);
    }

    private async sendHourlyReminders() {
        const guilds = this.client.guilds.cache;
        
        for (const guild of guilds.values()) {
            const channels = getChannels(guild.id);
            const targetChannels = [
                channels.vcReminderChannel1,
                channels.vcReminderChannel2
            ].filter(Boolean);

            for (const channelId of targetChannels) {
            try {
                const channel = await this.client.channels.fetch(channelId) as TextChannel;
                if (!channel) {
                    this.client.logger.error({
                        message: `Could not find reminder channel ${channelId}`,
                        handler: this.constructor.name,
                        error: new Error('Channel not found')
                    });
                    continue;
                }

                const previousMessageId = this.reminderData.messageIds[channelId];
                if (previousMessageId) {
                    try {
                        const previousMessage = await channel.messages.fetch(previousMessageId);
                        await previousMessage.delete();
                        this.client.logger.log({
                            message: `Deleted previous reminder ${previousMessageId} in ${channelId}`,
                            handler: this.constructor.name
                        }, true);
                    } catch (error) {
                        this.client.logger.log({
                            message: `Previous reminder ${previousMessageId} already deleted`,
                            handler: this.constructor.name
                        }, true);
                    }
                }

                const container = new ContainerBuilder();
                container.setAccentColor(0x5865F2);

                const reminderText = new TextDisplayBuilder()
                    .setContent('**Tip:** You can use the command `!myvc` to share a link to your voice channel!');

                container.addTextDisplayComponents(reminderText);

                const newMessage = await channel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { "parse": [] }
                });

                this.reminderData.messageIds[channelId] = newMessage.id;
                await this.saveReminderData();

                this.client.logger.log({
                    message: `Posted reminder ${newMessage.id} in ${channelId}`,
                    handler: this.constructor.name
                }, true);

            } catch (error) {
                this.client.logger.error({
                    message: `Failed to send reminder in channel ${channelId}`,
                    handler: this.constructor.name,
                    error: error as Error
                });
            }
            }
        }
    }

    private async loadReminderData() {
        try {
            await fs.access(this.reminderDataPath);
            const data = await fs.readFile(this.reminderDataPath, 'utf-8');
            this.reminderData = JSON.parse(data);
            this.client.logger.log({
                message: 'Loaded reminder data',
                handler: this.constructor.name
            }, true);
        } catch (error) {
            this.reminderData = { messageIds: {} };
            this.client.logger.log({
                message: 'Starting with fresh reminder data',
                handler: this.constructor.name
            }, true);
        }
    }

    private async saveReminderData() {
        try {
            await fs.writeFile(this.reminderDataPath, JSON.stringify(this.reminderData, null, 2));
        } catch (error) {
            this.client.logger.error({
                message: 'Failed to save reminder data',
                handler: this.constructor.name,
                error: error as Error
            });
        }
    }

    public async triggerReminders() {
        await this.sendHourlyReminders();
    }
}