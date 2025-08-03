import { Dirent, readdirSync } from 'fs';
import { EmbedBuilder, Collection, Interaction, ModalSubmitInteraction } from 'discord.js';
import Bot from '../Bot';
import BotInteraction from '../types/BotInteraction';
import ButtonHandler from './ButtonHandler';
import StringSelectHandler from './StringSelectHandler';
import EventEmitter = require('events');
import TicketHandler from './TicketHandler';
import LeaderboardHandler from './LeaderboardHandler';

export default interface InteractionHandler {
    client: Bot;
    commands: Collection<string, BotInteraction>;
    built: Boolean;
}

export default class InteractionHandler extends EventEmitter {
    constructor(client: Bot) {
        super();
        this.commands = new Collection();
        this.built = false;
        this.client = client;
        this.on('error', (error: unknown) => client.logger.error({ error }));
        this.client.on('interactionCreate', (interaction): Promise<any> => {
            return this.exec(interaction);
        });
    }

    /**
     * Builds the command collection by loading all interaction commands from the interactions directory
     */
    build() {
        if (this.built) return this;
        const dirs = readdirSync(`${this.client.location}/src/interactions`, { withFileTypes: true });
        const name = this.constructor.name;
        const commands = this.commands;
        const client = this.client;
        let cmds: Dirent[] = [];

        walk();

        async function walk() {
            if (!dirs.length) return;
            cmds = readdirSync(`${client.location}/src/interactions/${dirs[0].name}`, { withFileTypes: true }).filter((file) => file.name.endsWith('.ts'));
            await load(dirs[0].name);
            (dirs as Dirent[]).shift();
            walk();
        }

        async function load(dir: string) {
            if (!cmds.length) return;
            await actuallyLoad(dir, cmds[0]);
            (cmds as Dirent[]).shift();
            await load(dir);
        }

        async function actuallyLoad(dir: string, command: Dirent) {
            return new Promise(async (resolve) => {
                if (command.isFile()) {
                    const interaction = await import(`${client.location}/src/interactions/${dir}/${command.name}`);
                    const Command: BotInteraction = new interaction.default(client);
                    commands.set(Command.name, Command);
                    client.logger.log({ message: `Command '${Command.name}' loaded`, handler: name, uid: `(@${Command.uid})` }, true);
                }
                resolve(!0);
            });
        }
        return this;
    }

    public checkPermissionName(interaction: Interaction, role_name: string[]): boolean {
        if (!interaction.inCachedGuild()) return false;
        if (this.client.util.config.owners.includes(interaction.user.id)) return true;
        const _checkRoleName: boolean[] = role_name.map((role_string) => interaction.member.roles.cache.some((role) => role.name === role_string));
        const _containsRole: boolean = _checkRoleName.some((role) => role === true);
        return _containsRole;
    }

    public checkPermissionID(interaction: Interaction, role_id: string[]): boolean {
        if (!interaction.inCachedGuild()) return false;
        if (this.client.util.config.owners.includes(interaction.user.id)) return true;
        const _checkRoleID: boolean[] = role_id.map((role_id) => interaction.member.roles.cache.some((role) => role.id === role_id));
        const _containsRole: boolean = _checkRoleID.some((role) => role === true);
        return _containsRole;
    }

    async exec(interaction: Interaction): Promise<any> {
        if (interaction.isButton()) {
            if (interaction.inCachedGuild()) {
                this.client.logger.log({
                    message: `[InteractionHandler] Routing guild button interaction "${interaction.customId}" to ButtonHandler`,
                    handler: this.constructor.name
                }, true);
                return new ButtonHandler(this.client, interaction.customId, interaction);
            }
            else if (interaction.customId.startsWith('ticket:download_transcript_')) {
                this.client.logger.log({
                    message: `[InteractionHandler] Routing DM transcript download button "${interaction.customId}" to ButtonHandler static method`,
                    handler: this.constructor.name
                }, true);
                const forumPostId = interaction.customId.substring('ticket:download_transcript_'.length);
                return TicketHandler.handleDMTranscriptDownload(this.client, interaction, forumPostId);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('dpm_screenshots_')) {
                const command = this.commands.get('dpm-submit');
                if (command && 'handleModalSubmit' in command && typeof command.handleModalSubmit === 'function') {
                    return command.handleModalSubmit(interaction);
                }
            }

            if (interaction.customId.startsWith('ticket:') || interaction.customId.startsWith('ticket_')) {
                return new TicketHandler(this.client, interaction.customId, interaction);
            }

            if (interaction.customId.startsWith('leaderboard_')) {
                return new LeaderboardHandler(this.client, interaction.customId, interaction);
            }
        }

        if (interaction.isAutocomplete()) {
            const command = this.commands.get(interaction.commandName);
            if (command && command.autocomplete) {
                return command.autocomplete(interaction);
            }
        }

        if (interaction.isChatInputCommand()) {
            try {
                const command = this.commands.get(interaction.commandName);
                if (!command) return;

                switch (command.permissions) {
                    case 'OWNER':
                        if (interaction.isRepliable() && !this.client.util.config.owners.includes(interaction.user.id)) {
                            this.client.logger.log({
                                message: `Attempted restricted permissions. { command: ${command.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                                handler: this.constructor.name,
                            }, true);
                            return await interaction.reply({ content: 'You do not have permissions to run this command. This incident has been logged.', ephemeral: true });
                        }
                        break;
                    case 'ELEVATED_ROLE':
                        const hasRolePermissions = await this.client.util.hasRolePermissions(this.client, ['admin', 'owner'], interaction);
                        interface KeyMap {
                            [key: string]: string
                        }
                        const keyMap: KeyMap = {
                            'reports': 'reports',
                            'upkeep': 'trials'
                        }
                        if (command.name in keyMap) {
                            const overridePermissions = await this.client.util.hasOverridePermissions(interaction, keyMap[command.name]);
                            if (!(hasRolePermissions || overridePermissions)) {
                                this.client.logger.log({
                                    message: `Attempted restricted permissions. { command: ${command.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                                    handler: this.constructor.name,
                                }, true);
                                return await interaction.reply({ content: 'You do not have permissions to run this command. This incident has been logged.', ephemeral: true });
                            }
                        } else {
                            if (!hasRolePermissions) {
                                this.client.logger.log({
                                    message: `Attempted restricted permissions. { command: ${command.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                                    handler: this.constructor.name,
                                }, true);
                                return await interaction.reply({ content: 'You do not have permissions to run this command. This incident has been logged.', ephemeral: true });
                            }
                        }
                        break;
                    case 'TRIAL_TEAM':
                        if (!(await this.client.util.hasRolePermissions(this.client, ['trialTeam', 'admin', 'owner'], interaction))) {
                            this.client.logger.log({
                                message: `Attempted restricted permissions. { command: ${command.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                                handler: this.constructor.name,
                            }, true);
                            return await interaction.reply({ content: 'You do not have permissions to run this command. This incident has been logged.', ephemeral: true });
                        }
                        break;
                    case 'REAPER':
                        if (!(await this.client.util.hasRolePermissions(this.client, ['reaper', 'admin', 'owner'], interaction))) {
                            this.client.logger.log({
                                message: `Attempted restricted permissions. { command: ${command.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                                handler: this.constructor.name,
                            }, true);
                            return await interaction.reply({ content: 'You do not have permissions to run this command. This incident has been logged.', ephemeral: true });
                        }
                        break;
                    case 'TRIAL_TEAM_AND_TEACHER':
                        if (!(await this.client.util.hasRolePermissions(this.client, ['teacher', 'trialTeam', 'admin', 'owner'], interaction))) {
                            this.client.logger.log({
                                message: `Attempted restricted permissions. { command: ${command.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                                handler: this.constructor.name,
                            }, true);
                            return await interaction.reply({ content: 'You do not have permissions to run this command. This incident has been logged.', ephemeral: true });
                        }
                        break;
                    default:
                        break;
                }

                this.client.logger.log({
                    handler: this.constructor.name,
                    user: `${interaction.user.username} | ${interaction.user.id}`,
                    message: `Executing Command ${command.name}`,
                    uid: `(@${command.uid})`
                }, true);
                await command.run(interaction);
                this.client.commandsRun++;
            } catch (error: any) {
                const _error = error as Error;
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff99cc)
                    .setTitle('Something errored!')
                    .setDescription(`\`\`\`js\n ${_error.toString()}\`\`\``)
                    .setTimestamp()
                    .setFooter({ text: this.client.user?.username ?? '', iconURL: this.client.user?.displayAvatarURL() });
                this.client.logger.error({
                    handler: this.constructor.name,
                    message: 'Something errored!',
                    error: _error.stack,
                });
                interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        if (interaction.isStringSelectMenu() && interaction.inCachedGuild()) {
            return new StringSelectHandler(this.client, interaction.customId, interaction);
        }

        if (interaction.isUserSelectMenu() && interaction.inCachedGuild()) {
            if (interaction.customId.startsWith('leaderboard_')) {
                return new LeaderboardHandler(this.client, interaction.customId, interaction);
            }
        }
    }
}
