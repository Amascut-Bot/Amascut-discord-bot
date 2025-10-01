import Bot from '../Bot';
import * as cron from 'node-cron';
import { TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ReminderData {
    messageIds: { [channelId: string]: string };
    surveyMessageIds: { [channelId: string]: string };
}

export default class ReminderHandler {
    private client: Bot;
    private reminderDataPath: string;
    private reminderData: ReminderData = { messageIds: {}, surveyMessageIds: {} };

    constructor(client: Bot) {
        this.client = client;
        this.reminderDataPath = path.join(process.cwd(), 'reminder-data.json');
        this.loadReminderData();
    }

    public startReminders() {
        cron.schedule('*/30 * * * *', () => {
            this.sendHourlyReminders();
            this.sendSurveyReminders(); // Uncomment when needed
        });
        this.client.logger.log({
            message: 'Voice channel reminder system started (30-minute intervals)',
            handler: this.constructor.name
        }, true);
    }

    private async sendHourlyReminders() {
        const channels = this.client.channelIds;
        const targetChannels = [
            channels.reminderChannel1,
            channels.reminderChannel3,
            channels.reminderChannel4,
            channels.reminderChannel5,
            channels.reminderChannel6,
            channels.reminderChannel7,
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
                container.setAccentColor(this.client.color);

                const reminderText = new TextDisplayBuilder()
                    .setContent('**Tip:** You can use the command **!myvc** to share a link to your voice channel!');

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

    private async sendSurveyReminders() {
        const channels = this.client.channelIds;
        const targetChannels = [
            channels.reminderChannel1,
            channels.reminderChannel3,
            channels.reminderChannel4
        ].filter(Boolean);

        for (const channelId of targetChannels) {
            try {
                const channel = await this.client.channels.fetch(channelId) as TextChannel;
                if (!channel) {
                    this.client.logger.error({
                        message: `Could not find survey reminder channel ${channelId}`,
                        handler: this.constructor.name,
                        error: new Error('Channel not found')
                    });
                    continue;
                }

                const previousMessageId = this.reminderData.surveyMessageIds[channelId];
                if (previousMessageId) {
                    try {
                        const previousMessage = await channel.messages.fetch(previousMessageId);
                        await previousMessage.delete();
                        this.client.logger.log({
                            message: `Deleted previous survey reminder ${previousMessageId} in ${channelId}`,
                            handler: this.constructor.name
                        }, true);
                    } catch (error) {
                        this.client.logger.log({
                            message: `Previous survey reminder ${previousMessageId} already deleted`,
                            handler: this.constructor.name
                        }, true);
                    }
                }

                const container = new ContainerBuilder();
                container.setAccentColor(this.client.color);

                const reminderText = new TextDisplayBuilder()
                    .setContent('# Important\nAll hours are splits (Ironmen keeps) unless specified otherwise as per our <#1389379617915408445>.\nKeeps must be hosted in <#1413114658541539410> to avoid confusion.');

                container.addTextDisplayComponents(reminderText);

                const newMessage = await channel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { "parse": [] }
                });

                this.reminderData.surveyMessageIds[channelId] = newMessage.id;
                await this.saveReminderData();

                this.client.logger.log({
                    message: `Posted survey reminder ${newMessage.id} in ${channelId}`,
                    handler: this.constructor.name
                }, true);

            } catch (error) {
                this.client.logger.error({
                    message: `Failed to send survey reminder in channel ${channelId}`,
                    handler: this.constructor.name,
                    error: error as Error
                });
            }
        }
    }

    private async loadReminderData() {
        try {
            await fs.access(this.reminderDataPath);
            const data = await fs.readFile(this.reminderDataPath, 'utf-8');
            this.reminderData = JSON.parse(data);

            // Ensure surveyMessageIds exists for backward compatibility
            if (!this.reminderData.surveyMessageIds) {
                this.reminderData.surveyMessageIds = {};
            }

            this.client.logger.log({
                message: 'Loaded reminder data',
                handler: this.constructor.name
            }, true);
        } catch (error) {
            this.reminderData = { messageIds: {}, surveyMessageIds: {} };
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
        await this.sendSurveyReminders(); // Uncomment when needed
    }
}
