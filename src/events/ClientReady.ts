import { ActivityType, SlashCommandBuilder } from 'discord.js';
import Bot from '../Bot';
import BotEvent from '../types/BotEvent';
import TempChannelManager from '../modules/TempVCHandler';
import BossRevenue from '../interactions/admin/BossRevenue';
import BossRevenueV2 from '../interactions/admin/BossRevenueV2';
import { Timeout } from '../entity/Timeout';
import { LessThanOrEqual } from 'typeorm';
import { readdirSync } from 'fs';
import BotInteraction from '../types/BotInteraction';

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
        this.client.tempManager.__initParentListener(this.client.channelIds.tempVCCreate);
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

        // Start Amascut Revenue Auto-Refresh
        const amascutRevenue = new BossRevenueV2(this.client);
        amascutRevenue.startAutoRefresh();
        this.client.logger.log({ message: 'Amascut Revenue auto-refresh started (hourly intervals)' }, true);

        // Start Voice Channel Reminders
        this.client.reminderHandler.startReminders();

        // check elapsed timeouts
        setInterval(async (): Promise<void> => {
            this.client.logger.log({ message: 'Checking for elapsed timeouts...', handler: this.constructor.name }, true);
            const timeoutRepository = this.client.dataSource.getRepository(Timeout);
            const activeTimeouts = await timeoutRepository.find({
                where: {
                    isActive: true,
                    expiresAt: LessThanOrEqual(new Date(Date.now()))
                }
            });

            const guild = this.client.guilds.cache.find(guild => guild.id === process.env.GUILD_ID);

            for (let activeTimeout of activeTimeouts) {
                const member = await guild?.members.fetch(activeTimeout.user).catch(() => {});

                if (activeTimeout.type === 0) {
                    // nothing to do since discord handles this, should never come here
                    activeTimeout.isActive = false;
                } else if (activeTimeout.type === 1) {
                    await member?.roles.remove(this.client.roleIds.teamformingTimeout).catch(() => {});
                    activeTimeout.isActive = false;
                }
                await timeoutRepository.save(activeTimeout);
            }
        }, 300000);

        this.buildCommands();
    }

    //#region Command Building

    private async buildCommands() {
        let data: SlashCommandBuilder[] = [];
        await this.getCommands(data);

        // guild commands
        const guild = this.client.guilds.cache.find(guild => guild.id === process.env.GUILD_ID);
        const logChannel = await guild?.channels.fetch(this.client.channelIds.uploadLogChannel);
        let res = await guild!.commands.set(data).catch((e) => e);
        if (res instanceof Error) return this.client.logger.error({ error: res.stack, handler: this.constructor.name });
        const header = `Deploying (**${data.length.toLocaleString()}**) guild slash commands.`;
        const outputLines = data.map((command) => `${command.default_member_permissions === '0' ? '-' : '+'} ${command.name} - '${command.description}'`);
        return await this.sendSplitResponse(logChannel, header, outputLines);
    }

    private async sendSplitResponse(channel: any, header: string, lines: string[]) {
        await channel.send({ content: header });
        const messages = [];
        let currentMessage = '';
        for (const line of lines) {
            // 2000 limit - ```diff\n (7) - ``` (3) = 1990
            if (currentMessage.length + line.length + 1 > 1990) {
                messages.push(`\`\`\`diff\n${currentMessage}\`\`\``);
                currentMessage = '';
            }
            currentMessage += line + '\n';
        }
        if (currentMessage) {
            messages.push(`\`\`\`diff\n${currentMessage}\`\`\``);
        }
        for (const msg of messages) {
            await channel.send({ content: msg }).catch((err: Error) => {
                this.client.logger.error({ error: err.stack, handler: this.constructor.name });
            });
        }
    }

    private async getCommands(data: any[]) {
        const commandPromises = [];
        const directories = readdirSync(`${this.client.location}/src/interactions`, { withFileTypes: true });

        for (const directory of directories) {
            if (!directory.isDirectory()) continue;
            const commandFiles = readdirSync(`${this.client.location}/src/interactions/${directory.name}`, { withFileTypes: true });

            for (const commandFile of commandFiles) {
                if (!commandFile.isFile() || !commandFile.name.endsWith('.ts')) continue;

                commandPromises.push(
                    import(`${this.client.location}/src/interactions/${directory.name}/${commandFile.name}`)
                        .then(interactionModule => {
                            const Command: BotInteraction = new interactionModule.default(this.client);
                            if (Command.slashData) {
                                data.push(Command.slashData);
                            }
                        })
                        .catch(err => {
                            this.client.logger.error({
                                handler: this.constructor.name,
                                message: `Failed to load command: ${commandFile.name}`,
                                error: err.stack
                            });
                        })
                );
            }
        }
        await Promise.all(commandPromises);
    }

    //#endregion
}
