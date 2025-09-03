import { ActivityType } from 'discord.js';
import Bot from '../Bot';
import BotEvent from '../types/BotEvent';
import TempChannelManager from '../modules/TempVCHandler';
import { getChannels, getRoles } from '../GuildSpecifics';
import BossRevenue from '../interactions/admin/BossRevenue';
import { Timeout } from '../entity/Timeout';
import { LessThanOrEqual } from 'typeorm';

export default class ClientReady extends BotEvent {
    get name(): string {
        return 'clientReady';
    }

    get fireOnce(): boolean {
        return true;
    }

    get enabled(): boolean {
        return true;
    }

    private get statuses(): string[] {
        return ['Meowdy!'];
    }

    async run(client: Bot) {
        this.client.logger.log({ message: `[${this.client.user?.username}] Ready! Serving ${this.client.guilds.cache.size} guild(s) with ${this.client.users.cache.size} user(s)` }, true);

        // Build the global emoji cache
        this.client.emojiCache.clear();
        for (const guild of this.client.guilds.cache.values()) {
            for (const emoji of guild.emojis.cache.values()) {
                if (emoji.name) {
                    this.client.emojiCache.set(emoji.name, emoji);
                }
            }
        }
        this.client.logger.log({ message: `Built global cache with ${this.client.emojiCache.size} emojis.` }, true);

        this.client.tempManager = new TempChannelManager(this.client);
        this.client.tempManager.__initParentListener(getChannels(process.env.GUILD_ID).tempVCCreate);
        this.client.logger.log({ message: `Running on the ${process.env.ENVIRONMENT} environment` }, true);
        this.client.user?.setPresence({
            activities: [{ name: `Meowdy!`, type: ActivityType.Watching }]
        });
        setInterval((): void => {
            const current = this.statuses.shift() ?? '';
            this.client.user?.setPresence({
                activities: [{ name: current, type: ActivityType.Watching }]
            });
            this.statuses.push(current);
        }, 300000);
        this.client.logger.log({ message: `Startup complete. Amascut Bot is now online and operational.` }, true);

        // Start Twitch Monitoring
        this.client.twitchHandler.startMonitoring();

        // Start Boss Revenue Auto-Updater
        BossRevenue.startAutoUpdater(this.client);
        this.client.logger.log({ message: 'Boss Revenue auto-updater started (10-minute intervals)' }, true);

        // Start Voice Channel Reminders
        this.client.reminderHandler.startReminders();

        // check elapsed timeouts
        setInterval(async (): Promise<void> => {
            const timeoutRepository = this.client.dataSource.getRepository(Timeout);
            const activeTimeouts = await timeoutRepository.find({
                where: {
                    isActive: true,
                    expiresAt: LessThanOrEqual(new Date(Date.now()))
                }
            });

            const guild = this.client.guilds.cache.find(guild => guild.id === process.env.GUILD_ID);
            const timeoutRoleId = getRoles(guild?.id, true).teamformingTimeout;

            for (let activeTimeout of activeTimeouts) {
                const member = await guild?.members.fetch(activeTimeout.user).catch();

                if (activeTimeout.type === 0) {
                    // nothing to do since discord handles this, should never come here
                    activeTimeout.isActive = false;
                } else if (activeTimeout.type === 1) {
                    await member?.roles.remove(timeoutRoleId).catch();
                    activeTimeout.isActive = false;
                }
                await timeoutRepository.save(activeTimeout);
            }
        }, 300000);
    }
}
