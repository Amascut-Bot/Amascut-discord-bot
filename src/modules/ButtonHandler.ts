import { ActionRowBuilder, APIEmbedField, ButtonBuilder, ButtonInteraction, ButtonStyle, Embed, EmbedBuilder, GuildMember, InteractionResponse, Message, Role, TextChannel, MessageFlags, ContainerComponent, TextDisplayComponent, SectionComponent, SectionBuilder, TextDisplayBuilder } from 'discord.js';
import { DpmSubmission } from '../entity/DpmSubmission';
import { KillTimeSubmission } from '../entity/KillTimeSubmission';
import { Report } from '../entity/Report';
import { Trial } from '../entity/Trial';
import { TrialParticipation } from '../entity/TrialParticipation';
import { Reaper } from '../entity/Reaper';
import { ReaperParticipation } from '../entity/ReaperParticipation';
import Bot from '../Bot';
import * as fs from 'fs/promises';
import * as path from 'path';
import TicketHandler from './TicketHandler';
import { getChannels, getRoles } from '../GuildSpecifics';

// ===============================
// CONSTANTS
// ===============================
const leaderboardConfigPath = path.join(process.cwd(), 'leaderboard-config.json');
const killTimeLeaderboardConfigPath = path.join(process.cwd(), 'killtime-leaderboard-config.json');

// ===============================
// INTERFACES
// ===============================
interface RemoveHierarchy {
    [key: string]: string[];
}

interface Hierarchy {
    [key: string]: string[];
}

interface Prerequisites {
    [prerequisite: string]: Prerequisite
}

interface Prerequisite {
    [key: string]: string[]
}

// ===============================
// MAIN CLASS
// ===============================
export default class ButtonHandler {
    client: Bot;
    id: string;
    interaction: ButtonInteraction<'cached'>;

    constructor(client: Bot, id: string, interaction: ButtonInteraction<'cached'>) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        this.client.logger.log({
            message: `[ButtonHandler] Processing button interaction: "${id}" from user ${interaction.user.id}`,
            handler: this.constructor.name
        }, true);

        if (id.startsWith('ticket')) {
            new TicketHandler(this.client, interaction.customId, interaction);
            return;
        }

        if (id.startsWith('selfassign_')) {
            this.handleSelfAssign(interaction, id.slice(11));
            return;
        }

        if (id.startsWith('host_')) {
            this.handleHost(interaction, id.slice(11));
            return;
        }

        switch (id) {
            case 'rejectRoleAssign': this.rejectRoleAssign(interaction); break;
            case 'approveReport': this.approveReport(interaction); break;
            case 'rejectReport': this.rejectReport(interaction); break;
            case 'approveDPM': this.approveDPM(interaction); break;
            case 'rejectDPM': this.rejectDPM(interaction); break;
            case 'approveKillTime': this.approveKillTime(interaction); break;
            case 'rejectKillTime': this.rejectKillTime(interaction); break;
            case 'selectBase': this.selectBase(interaction); break;
            case 'selectDPS': this.selectDPS(interaction); break;
            case 'selectOutside': this.selectOutside(interaction); break;
            case 'selectElf': this.selectElf(interaction); break;
            case 'disbandTrial': this.disbandTrial(interaction); break;
            case 'disbandReaper': this.disbandReaper(interaction); break;
            case 'startTrial': this.startTrial(interaction); break;
            case 'startReaper': this.startReaper(interaction); break;
            case 'passTrialee': this.passTrialee(interaction); break;
            case 'completeReaper': this.completeReaper(interaction); break;
            case 'failTrialee': this.failTrialee(interaction); break;
            case 'nextUpkeep': this.nextUpkeep(interaction); break;
            case 'prevUpkeep': this.prevUpkeep(interaction); break;
        }
    }

    // ===============================
    // UTILITY GETTERS
    // ===============================
    get userId(): string {
        return this.interaction.user.id;
    }

    get currentTime(): number {
        return Math.round(Date.now() / 1000)
    }

    // ===============================
    // UPKEEP SYSTEM
    // ===============================
    public getUpkeepMembers = async (pastDate: Date, interaction: ButtonInteraction<'cached'>) => {
        const { dataSource } = this.client;
        const { stripRole } = this.client.util;

        const trialsParticipated = await dataSource.createQueryBuilder()
            .select('trialParticipation.participant', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(TrialParticipation, 'trialParticipation')
            .where('trialParticipation.createdAt > :pastDate', { pastDate })
            .groupBy('trialParticipation.participant')
            .orderBy('count', 'DESC')
            .getRawMany();

        const participation: any = {}
        trialsParticipated.forEach((trial: any) => {
            participation[trial.user] = trial.count;
        })

        const trialTeamMembers = await interaction.guild?.members.fetch().then(members => {
            return members.filter(member => member.roles.cache.has(stripRole(getRoles(interaction.guild?.id).trialTeam))).map(member => member.id)
        });

        const sortableArray: any = [];
        trialTeamMembers?.forEach(userId => {
            if (participation[userId]) {
                sortableArray.push([userId, participation[userId]]);
            } else {
                sortableArray.push([userId, 0]);
            }
        });
        sortableArray.sort((a: any, b: any) => b[1] - a[1]);
        return sortableArray;
    }

    public createUpkeepString = (members: any) => {
        let fieldString = '';
        members.slice(0, 10).forEach((member: any) => {
            fieldString += `⬥ <@${member[0]}> - **${member[1]}**\n`
        })
        return fieldString;
    }

    private async nextUpkeep(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { colours, hasRolePermissions, hasOverridePermissions } = this.client.util;
        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'assign');

        const messageEmbed: Embed = interaction.message.embeds[0];
        const messageContent: string | undefined = messageEmbed.data.description;
        const footer = messageEmbed.footer;
        const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
        const timeExpression: RegExp = /<t:(\d+):D>/;
        const pageExpression: RegExp = /Page (\d+) of (\d+)/;
        const replyEmbed: EmbedBuilder = new EmbedBuilder();
        let timeInSeconds: number = 0;
        let pageNumber: number = 0;
        let totalPages: number = 0;
        if (messageContent) {
            const timeMatches = messageContent.match(timeExpression);
            const pageMatches = footer?.text.match(pageExpression);
            timeInSeconds = timeMatches ? Number(timeMatches[1]) : 0;
            pageNumber = pageMatches ? Number(pageMatches[1]) : 0;
            totalPages = pageMatches ? Number(pageMatches[2]) : 0;
            if (!timeInSeconds || !pageNumber || !totalPages) {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription('Time or page numbers could not be detected.')
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }
        if (rolePermissions || overridePermissions) {
            const general = messageContent?.split('⬥')[0];
            const dateObject = new Date(timeInSeconds * 1000);
            const nextPage = pageNumber + 1;

            const upkeepData = await this.getUpkeepMembers(dateObject, interaction);
            const upkeepMembers = upkeepData.slice(pageNumber * 10, nextPage * 10);

            const middleNav = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prevUpkeep')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('nextUpkeep')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                );

            const endNav = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prevUpkeep')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                );

            const navigation = nextPage === totalPages ? endNav : middleNav;
            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setTitle('Trial Team Upkeep')
                .setColor(messageEmbed.color)
                .setFooter({ text: `Page ${nextPage} of ${totalPages}` })
                .setDescription(`${general}${this.createUpkeepString(upkeepMembers)}`)
            await interaction.message.edit({ content: '', embeds: [newEmbed], components: [navigation] });

        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Next Upkeep, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async prevUpkeep(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { colours, hasRolePermissions, hasOverridePermissions } = this.client.util;
        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'trials');

        const messageEmbed: Embed = interaction.message.embeds[0];
        const messageContent: string | undefined = messageEmbed.data.description;
        const footer = messageEmbed.footer;
        const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
        const timeExpression: RegExp = /<t:(\d+):D>/;
        const pageExpression: RegExp = /Page (\d+) of (\d+)/;
        const replyEmbed: EmbedBuilder = new EmbedBuilder();
        let timeInSeconds: number = 0;
        let pageNumber: number = 0;
        let totalPages: number = 0;
        if (messageContent) {
            const timeMatches = messageContent.match(timeExpression);
            const pageMatches = footer?.text.match(pageExpression);
            timeInSeconds = timeMatches ? Number(timeMatches[1]) : 0;
            pageNumber = pageMatches ? Number(pageMatches[1]) : 0;
            totalPages = pageMatches ? Number(pageMatches[2]) : 0;
            if (!timeInSeconds || !pageNumber || !totalPages) {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription('Time or page numbers could not be detected.')
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }
        if (rolePermissions || overridePermissions) {
            const general = messageContent?.split('⬥')[0];

            const dateObject = new Date(timeInSeconds * 1000);
            const nextPage = pageNumber - 1;

            const upkeepData = await this.getUpkeepMembers(dateObject, interaction);
            const upkeepMembers = upkeepData.slice((nextPage - 1) * 10, nextPage * 10);

            const middleNav = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prevUpkeep')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('nextUpkeep')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                );

            const endNav = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('nextUpkeep')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                );

            const navigation = nextPage === 1 ? endNav : middleNav;
            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setTitle('Trial Team Upkeep')
                .setColor(messageEmbed.color)
                .setFooter({ text: `Page ${nextPage} of ${totalPages}` })
                .setDescription(`${general}${this.createUpkeepString(upkeepMembers)}`)
            await interaction.message.edit({ content: '', embeds: [newEmbed], components: [navigation] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Previous Upkeep, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    // ===============================
    // ROLE ASSIGNMENT SYSTEM
    // ===============================
    public async assignMatchmakingRole(interaction: ButtonInteraction<'cached'>, cleanRoleId: string, trialeeId: string) {
        const { colours, stripRole, categorize, getKeyFromValue } = this.client.util;

        const hierarchy: Hierarchy = {
            threeSeven: ['noRealm', 'threeSevenRootskips', 'rootskips', 'threeSevenExperienced', 'experienced', 'threeSevenMaster', 'master', 'threeSevenGrandmaster', 'grandmaster'],
            duo: ['duoRootskips', 'rootskips', 'duoExperienced', 'experienced', 'duoMaster', 'master', 'duoGrandmaster', 'grandmaster'],
            combined: ['rootskips', 'experienced', 'master', 'grandmaster'],
        }

        const removeHierarchy: RemoveHierarchy = {
            'threeSevenRootskips': ['noRealm'],
            'duoExperienced': ['duoRootskips'],
            'threeSevenExperienced': ['threeSevenRootskips', 'noRealm'],
            'duoMaster': ['duoExperienced', 'duoRootskips'],
            'threeSevenMaster': ['threeSevenExperienced', 'threeSevenRootskips', 'noRealm'],
            'duoGrandmaster': ['duoMaster', 'duoExperienced', 'duoRootskips'],
            'threeSevenGrandmaster': ['threeSevenMaster', 'threeSevenExperienced', 'threeSevenRootskips', 'noRealm'],
            'rootskips': ['noRealm'],
            'experienced': ['noRealm', 'rootskips'],
            'master': ['noRealm', 'rootskips', 'experienced'],
            'grandmaster': ['noRealm', 'rootskips', 'experienced', 'master'],
        }

        const prerequisites: Prerequisites = {
            'duoRootskips': {
                'rootskips': ['threeSevenRootskips']
            },
            'threeSevenRootskips': {
                'rootskips': ['duoRootskips']
            },
            'duoExperienced': {
                'experienced': ['threeSevenExperienced']
            },
            'threeSevenExperienced': {
                'experienced': ['duoExperienced']
            },
            'duoMaster': {
                'master': ['threeSevenMaster']
            },
            'threeSevenMaster': {
                'master': ['duoMaster']
            },
            'duoGrandmaster': {
                'grandmaster': ['threeSevenGrandmaster']
            },
            'threeSevenGrandmaster': {
                'grandmaster': ['duoGrandmaster']
            }
        }

        const hasHigherRole = (role: string) => {
            try {
                if (!categorize(role)) return false;
                const categorizedHierarchy = hierarchy[categorize(role)];
                const sliceFromIndex: number = categorizedHierarchy.indexOf(role) + 1;
                const hierarchyList = categorizedHierarchy.slice(sliceFromIndex);
                const hierarchyIdList = hierarchyList.map((item: string) => stripRole(getRoles(interaction.guild?.id)[item]));
                const intersection = hierarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
                if (intersection.length === 0) {
                    return false
                } else {
                    return true
                };
            }
            catch (err) { return false }
        }

        const role = getKeyFromValue(getRoles(interaction.guild?.id), `<@&${cleanRoleId}>`);
        const user = await interaction.guild?.members.fetch(trialeeId);
        const userRoles = user?.roles.cache.map(role => role.id) || [];

        let sendMessage = false;
        let anyAdditionalRole;
        const roleObject = await interaction.guild?.roles.fetch(stripRole(getRoles(interaction.guild?.id)[role])) as Role;
        let embedColour = colours.discord.green;

        const channel = await this.client.channels.fetch(getChannels(interaction.guild?.id).roleConfirmations) as TextChannel;

        if (role in prerequisites) {
            for (const key in prerequisites[role]) {
                if (userRoles?.includes(stripRole(getRoles(interaction.guild?.id)[key])) && hasHigherRole(role)) {
                    break;
                };
                let assign = true;
                prerequisites[role][key].forEach((prereqRole: string) => {
                    const roleId = stripRole(getRoles(interaction.guild?.id)[prereqRole]);
                    if (!(userRoles?.includes(roleId))) {
                        assign = false;
                    }
                })
                if (assign) {
                    const assignedRoleId = stripRole(getRoles(interaction.guild?.id)[key]);
                    if (!(userRoles?.includes(assignedRoleId)) && !hasHigherRole(role)) {
                        sendMessage = true;
                    }
                    if (!hasHigherRole(role) && !userRoles?.includes(assignedRoleId)) await user?.roles.add(assignedRoleId);
                    embedColour = roleObject.color ?? this.client.color;
                    prerequisites[role][key].forEach((prereqRole: string) => {
                        const roleId = stripRole(getRoles(interaction.guild?.id)[prereqRole]);
                        if (userRoles?.includes(roleId)) user?.roles.remove(roleId);
                    })
                    if ((key in removeHierarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of removeHierarchy[key]) {
                            const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                            if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                        };
                    }
                    if ((role in removeHierarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of removeHierarchy[role]) {
                            const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                            if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                        };
                    }
                    anyAdditionalRole = key;
                } else {
                    const roleId = stripRole(getRoles(interaction.guild?.id)[role]);
                    if (!hasHigherRole(role) && !userRoles?.includes(roleId)) user?.roles.add(roleId);
                    embedColour = roleObject.color ?? this.client.color;
                    if (!(userRoles?.includes(roleId)) && !hasHigherRole(role)) {
                        sendMessage = true;
                    }
                    if ((role in removeHierarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of removeHierarchy[role]) {
                            const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                            if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                        };
                    }
                }
            }
        } else {
            const roleId = stripRole(getRoles(interaction.guild?.id)[role]);
            if (!hasHigherRole(role) && !userRoles?.includes(roleId)) await user?.roles.add(roleId);
            embedColour = roleObject.color ?? this.client.color;
            if (!(userRoles?.includes(roleId)) && !hasHigherRole(role)) {
                sendMessage = true;
            }
            if (role in removeHierarchy) {
                for await (const roleToRemove of removeHierarchy[role]) {
                    const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                };
            }
        }

        let returnedMessage = {
            id: '',
            url: ''
        };
        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
            .setTimestamp()
            .setColor(embedColour)
            .setDescription(`
            Congratulations to <@${trialeeId}> on achieving ${getRoles(interaction.guild?.id)[role]}!
            ${anyAdditionalRole ? `By achieving this role, they are also awarded ${getRoles(interaction.guild?.id)[anyAdditionalRole]}!` : ''}
            `);
        if (sendMessage && channel) await channel.send({ embeds: [embed] }).then(message => {
            returnedMessage.id = message.id;
            returnedMessage.url = message.url;

            const emojis = ['Pog', 'gz'];

            for (let index = 0; index < emojis.length; index++) {
                const emoji = this.client.emojiCache.get(emojis[index]);

                if (emoji) {
                    message.react(emoji);
                }
            }
        });

        const logChannel = await this.client.channels.fetch(getChannels(interaction.guild?.id).botRoleLog) as TextChannel;
        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rejectRoleAssign')
                    .setLabel('Reject Approval')
                    .setStyle(ButtonStyle.Danger),
            );
        const logEmbed = new EmbedBuilder()
            .setTimestamp()
            .setColor(embedColour)
            .setDescription(`
            ${getRoles(interaction.guild?.id)[role]} was assigned to <@${trialeeId}> by <@${interaction.user.id}>.
            ${anyAdditionalRole ? `${getRoles(interaction.guild?.id)[anyAdditionalRole]} was also assigned.\n` : ''}
            **Message**: [${returnedMessage.id}](${returnedMessage.url})
            `);
        if (sendMessage) await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });
    }

    // ===============================
    // DATABASE OPERATIONS
    // ===============================
    public async sendReaperSquadMessage(interaction: ButtonInteraction<'cached'>, reaperId: string, fields: APIEmbedField[]): Promise<void> {
        const { colours } = this.client.util;
        const channel = await this.client.channels.fetch(getChannels(interaction.guild?.id).reaperSquad) as TextChannel;
        let userString = '';
        fields.forEach((member: APIEmbedField) => {
            if (member.value !== '`Empty`' && !member.value.includes('Reaper')) {
                userString += `${member.value} `;
            }
        })
        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
            .setTimestamp()
            .setColor(this.client.color)
            .setDescription(`
            Congratulations to <@${reaperId}> on achieving their first solak kill!\n
            ${getRoles(interaction.guild?.id).reaper} ${userString}
            `);
        await channel.send({ embeds: [embed] });
    }

    public async saveReaper(interaction: ButtonInteraction<'cached'>, reaperId: string, userId: string, fields: APIEmbedField[]): Promise<void> {
        const { dataSource } = this.client;
        const reaperRepository = dataSource.getRepository(Reaper);
        const reaperObject = new Reaper();
        reaperObject.recipient = reaperId;
        reaperObject.host = userId;
        reaperObject.link = interaction.message.url;
        const reaper = await reaperRepository.save(reaperObject);

        const reaperParticipants: ReaperParticipation[] = [];
        fields.forEach((member: APIEmbedField) => {
            if (member.value !== '`Empty`' && !member.value.includes('Reaper')) {
                const participant = new ReaperParticipation();
                participant.participant = member.value.slice(2, -1);
                participant.reaper = reaper;
                reaperParticipants.push(participant);
            }
        })

        const participantReposittory = dataSource.getRepository(ReaperParticipation);
        await participantReposittory.save(reaperParticipants);
    }

    public async saveTrial(interaction: ButtonInteraction<'cached'>, trialeeId: string, roleId: string, userId: string, fields: APIEmbedField[]): Promise<void> {
        const { dataSource } = this.client;
        const trialRepository = dataSource.getRepository(Trial);
        const trialObject = new Trial();
        trialObject.trialee = trialeeId;
        trialObject.host = userId;
        trialObject.role = roleId;
        trialObject.link = interaction.message.url;
        const trial = await trialRepository.save(trialObject);

        const trialParticipants: TrialParticipation[] = [];
        fields.forEach((member: APIEmbedField) => {
            if (member.value !== '`Empty`' && !member.value.includes('Trialee')) {
                const participant = new TrialParticipation();
                participant.participant = member.value.slice(2, -1);
                participant.role = member.name;
                participant.trial = trial;
                trialParticipants.push(participant);
            }
        })

        const participantReposittory = dataSource.getRepository(TrialParticipation);
        await participantReposittory.save(trialParticipants);
    }

    // ===============================
    // TRIAL & REAPER MANAGEMENT
    // ===============================
    public async handleRoleSelection(interaction: ButtonInteraction<'cached'>, roleString: string): Promise<Message<true> | InteractionResponse<true> | void> {
        const { colours, checkForUserId, getEmptyObject } = this.client.util;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const hasRolePermissions = await this.client.util.hasRolePermissions(this.client, ['reaper', 'trialTeam'], interaction);
        if (hasRolePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const fields = messageEmbed.fields;
            const existingRole = checkForUserId(`<@${interaction.user.id}>`, fields);
            const replyEmbed = new EmbedBuilder();
            if (existingRole) {
                const { obj: role, index } = existingRole;
                if (role.name === roleString) {
                    fields[index].value = '`Empty`';
                    replyEmbed.setColor(colours.discord.green).setDescription(`Successfully unassigned from **${roleString}**.`);
                } else {
                    replyEmbed.setColor(colours.discord.red).setDescription('You are signed up as a different role. Unassign from that role first.');
                }
            } else {
                const firstEmptyObject = getEmptyObject(roleString, fields);
                if (firstEmptyObject) {
                    const { index } = firstEmptyObject;
                    fields[index].value = `<@${interaction.user.id}>`;
                    replyEmbed.setColor(colours.discord.green).setDescription(`Successfully assigned to **${roleString}**.`);
                } else {
                    replyEmbed.setColor(colours.discord.red).setDescription(`**${roleString}** is already taken.`);
                }
            }
            const newEmbed = new EmbedBuilder()
                .setColor(messageEmbed.color)
                .setDescription(`${messageContent}`)
                .setFields(fields);
            await interaction.message.edit({ embeds: [newEmbed] })
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Select ${roleString} Role, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async selectBase(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await this.handleRoleSelection(interaction, 'Base');
    }

    private async selectDPS(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await this.handleRoleSelection(interaction, 'DPS');
    }

    private async selectOutside(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await this.handleRoleSelection(interaction, 'Outside');
    }

    private async selectElf(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await this.handleRoleSelection(interaction, 'Elf');
    }

    private async disbandEvent(interaction: ButtonInteraction<'cached'>, eventType: string, permissions: string[]): Promise<Message<true> | InteractionResponse<true> | void> {
        const { colours } = this.client.util;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const hasRolePermissions: boolean | undefined = await this.client.util.hasRolePermissions(this.client, permissions, interaction);
        const messageEmbed: Embed = interaction.message.embeds[0];
        const messageContent: string | undefined = messageEmbed.data.description;
        const expression: RegExp = /\`Host:\` <@(\d+)>/;
        const replyEmbed: EmbedBuilder = new EmbedBuilder();
        let userId: string = '';
        if (messageContent) {
            const matches = messageContent.match(expression);
            userId = matches ? matches[1] : '';
            if (!userId) {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription('Host could not be detected.')
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }
        if (hasRolePermissions) {
            const hasElevatedRole = await this.client.util.hasRolePermissions(this.client, ['moderator', 'admin', 'owner'], interaction);
            if ((interaction.user.id === userId) || hasElevatedRole) {
                const newMessageContent = messageContent?.replace('> **Team**', '');
                const newEmbed = new EmbedBuilder()
                    .setColor(messageEmbed.color)
                    .setDescription(`${newMessageContent}> ${this.client.util.capitalizeFirstLetter(eventType)} disbanded <t:${this.currentTime}:R>.`);
                await interaction.message.edit({ content: '', embeds: [newEmbed], components: [] });
                replyEmbed.setColor(colours.discord.green);
                replyEmbed.setDescription(`Trial successfully disbanded!`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription(`Only <@${userId}> or an elevated role can disband this ${eventType}.`)
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Disband ${eventType}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async disbandTrial(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await this.disbandEvent(interaction, 'trial', ['trialTeam', 'moderator', 'admin', 'owner']);
    }

    private async disbandReaper(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await this.disbandEvent(interaction, 'reaper', ['reaper', 'moderator', 'admin', 'owner']);
    }

    private async startTrial(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        const { colours } = this.client.util;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const hasRolePermissions: boolean | undefined = await this.client.util.hasRolePermissions(this.client, ['trialTeam'], interaction);
        const messageEmbed: Embed = interaction.message.embeds[0];
        const messageContent: string | undefined = messageEmbed.data.description;
        const fields: APIEmbedField[] = messageEmbed.fields;
        const expression: RegExp = /\`Host:\` <@(\d+)>/;
        const replyEmbed: EmbedBuilder = new EmbedBuilder();
        let userId: string = '';
        if (messageContent) {
            const matches = messageContent.match(expression);
            userId = matches ? matches[1] : '';
            if (!userId) {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription('Host could not be detected.')
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }
        if (hasRolePermissions) {
            const hasElevatedRole = await this.client.util.hasRolePermissions(this.client, ['moderator', 'admin', 'owner'], interaction);
            if ((interaction.user.id === userId) || hasElevatedRole) {
                const trialStarted = `> **Moderation**\n\n ⬥ Trial started <t:${this.currentTime}:R>.\n\n> **Team**`;
                const newMessageContent = messageContent?.replace('> **Team**', trialStarted);
                const newEmbed = new EmbedBuilder()
                    .setColor(messageEmbed.color)
                    .setFields(fields)
                    .setDescription(`${newMessageContent}`);
                const controlPanel = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('passTrialee')
                            .setLabel('Pass')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('failTrialee')
                            .setLabel('Fail')
                            .setStyle(ButtonStyle.Danger)
                    );
                await interaction.message.edit({ content: '', embeds: [newEmbed], components: [controlPanel] });
                replyEmbed.setColor(colours.discord.green);
                replyEmbed.setDescription(`Trial successfully started!`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription(`Only <@${userId}> or an elevated role can start this trial.`)
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Start Trial, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async startReaper(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        const { colours } = this.client.util;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const hasRolePermissions: boolean | undefined = await this.client.util.hasRolePermissions(this.client, ['reaper'], interaction);
        const messageEmbed: Embed = interaction.message.embeds[0];
        const messageContent: string | undefined = messageEmbed.data.description;
        const fields: APIEmbedField[] = messageEmbed.fields;
        const expression: RegExp = /\`Host:\` <@(\d+)>/;
        const replyEmbed: EmbedBuilder = new EmbedBuilder();
        let userId: string = '';
        if (messageContent) {
            const matches = messageContent.match(expression);
            userId = matches ? matches[1] : '';
            if (!userId) {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription('Host could not be detected.')
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }
        if (hasRolePermissions) {
            const hasElevatedRole = await this.client.util.hasRolePermissions(this.client, ['moderator', 'admin', 'owner'], interaction);
            if ((interaction.user.id === userId) || hasElevatedRole) {
                const trialStarted = `> **Moderation**\n\n ⬥ Reaper started <t:${this.currentTime}:R>.\n\n> **Team**`;
                const newMessageContent = messageContent?.replace('> **Team**', trialStarted);
                const newEmbed = new EmbedBuilder()
                    .setColor(messageEmbed.color)
                    .setFields(fields)
                    .setDescription(`${newMessageContent}`);
                const controlPanel = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('completeReaper')
                            .setLabel('Finish')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('disbandReaper')
                            .setLabel('Disband')
                            .setStyle(ButtonStyle.Danger)
                    );
                await interaction.message.edit({ content: '', embeds: [newEmbed], components: [controlPanel] });
                replyEmbed.setColor(colours.discord.green);
                replyEmbed.setDescription(`Reaper successfully started!`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription(`Only <@${userId}> or an elevated role can start this reaper.`)
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Start Reaper, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async completeReaper(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        const { colours } = this.client.util;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const hasRolePermissions: boolean | undefined = await this.client.util.hasRolePermissions(this.client, ['reaper'], interaction);
        const messageEmbed: Embed = interaction.message.embeds[0];
        const messageContent: string | undefined = messageEmbed.data.description;
        const fields: APIEmbedField[] = messageEmbed.fields;
        const hostExpression: RegExp = /\`Host:\` <@(\d+)>/;
        const trialeeExpression: RegExp = /\`Discord:\` <@(\d+)>/;
        const replyEmbed: EmbedBuilder = new EmbedBuilder();
        let userId: string = '';
        let reaperId: string = '';
        if (messageContent) {
            const hostMatches = messageContent.match(hostExpression);
            const trialeeMatches = messageContent.match(trialeeExpression);
            userId = hostMatches ? hostMatches[1] : '';
            reaperId = trialeeMatches ? trialeeMatches[1] : '';
            if (!userId || !reaperId) {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription('Host or Reaper ID could not be detected.')
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }
        if (hasRolePermissions) {
            const hasElevatedRole = await this.client.util.hasRolePermissions(this.client, ['moderator', 'admin', 'owner'], interaction);
            if ((interaction.user.id === userId) || hasElevatedRole) {
                const splitResults = messageContent?.split('⬥');
                if (!splitResults) {
                    replyEmbed.setColor(colours.discord.red)
                    replyEmbed.setDescription(`Message could not be parsed correctly.`)
                    return await interaction.editReply({ embeds: [replyEmbed] });
                }
                const messageContentWithoutStarted = splitResults[0];
                const dirtyStarted = splitResults[1];
                const started = dirtyStarted?.replace('> **Team**', '').trim();
                const newMessageContent = `${messageContentWithoutStarted}⬥ ${started}\n⬥ <@${reaperId}> got their kill <t:${this.currentTime}:R>!\n\n> **Team**`;

                await this.sendReaperSquadMessage(interaction, reaperId, fields);
                await this.saveReaper(interaction, reaperId, userId, fields);

                const newEmbed = new EmbedBuilder()
                    .setColor(colours.discord.green)
                    .setFields(fields)
                    .setDescription(`${newMessageContent}`);
                await interaction.message.edit({ content: '', embeds: [newEmbed], components: [] });
                replyEmbed.setColor(colours.discord.green);
                replyEmbed.setDescription(`Reaper successfully completed!`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription(`Only <@${userId}> or an elevated role can complete this reaper.`)
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Complete Reaper, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async passTrialee(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        const { colours } = this.client.util;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const hasRolePermissions: boolean | undefined = await this.client.util.hasRolePermissions(this.client, ['trialTeam'], interaction);
        const messageEmbed: Embed = interaction.message.embeds[0];
        const messageContent: string | undefined = messageEmbed.data.description;
        const fields: APIEmbedField[] = messageEmbed.fields;
        const hostExpression: RegExp = /\`Host:\` <@(\d+)>/;
        const trialeeExpression: RegExp = /\`Discord:\` <@(\d+)>/;
        const roleExpression: RegExp = /\`Tag:\` <@&(\d+)>/;
        const replyEmbed: EmbedBuilder = new EmbedBuilder();
        let userId: string = '';
        let trialeeId: string = '';
        let roleId: string = '';
        if (messageContent) {
            const hostMatches = messageContent.match(hostExpression);
            const trialeeMatches = messageContent.match(trialeeExpression);
            const roleMatches = messageContent.match(roleExpression);
            userId = hostMatches ? hostMatches[1] : '';
            trialeeId = trialeeMatches ? trialeeMatches[1] : '';
            roleId = roleMatches ? roleMatches[1] : '';
            if (!userId || !trialeeId || !roleId) {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription('Host, Trialee or Tag could not be detected.')
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }
        if (hasRolePermissions) {
            const hasElevatedRole = await this.client.util.hasRolePermissions(this.client, ['moderator', 'admin', 'owner'], interaction);
            if ((interaction.user.id === userId) || hasElevatedRole) {
                const splitResults = messageContent?.split('⬥');
                if (!splitResults) {
                    replyEmbed.setColor(colours.discord.red)
                    replyEmbed.setDescription(`Message could not be parsed correctly.`)
                    return await interaction.editReply({ embeds: [replyEmbed] });
                }
                const messageContentWithoutStarted = splitResults[0];
                const dirtyStarted = splitResults[1];
                const started = dirtyStarted?.replace('> **Team**', '').trim();
                const newMessageContent = `${messageContentWithoutStarted}⬥ ${started}\n⬥ <@${trialeeId}> successfully passed <t:${this.currentTime}:R>!\n\n> **Team**`;

                await this.saveTrial(interaction, trialeeId, roleId, userId, fields);
                await this.assignMatchmakingRole(interaction, roleId, trialeeId);

                const newEmbed = new EmbedBuilder()
                    .setColor(colours.discord.green)
                    .setFields(fields)
                    .setDescription(`${newMessageContent}`);
                await interaction.message.edit({ content: '', embeds: [newEmbed], components: [] });
                replyEmbed.setColor(colours.discord.green);
                replyEmbed.setDescription(`Trialee successfully passed!`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription(`Only <@${userId}> or an elevated role can pass this trialee.`)
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Pass Trialee, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async failTrialee(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        const { colours } = this.client.util;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const hasRolePermissions: boolean | undefined = await this.client.util.hasRolePermissions(this.client, ['trialTeam'], interaction);
        const messageEmbed: Embed = interaction.message.embeds[0];
        const messageContent: string | undefined = messageEmbed.data.description;
        const fields: APIEmbedField[] = messageEmbed.fields;
        const hostExpression: RegExp = /\`Host:\` <@(\d+)>/;
        const trialeeExpression: RegExp = /\`Discord:\` <@(\d+)>/;
        const roleExpression: RegExp = /\`Tag:\` <@&(\d+)>/;
        const replyEmbed: EmbedBuilder = new EmbedBuilder();
        let userId: string = '';
        let trialeeId: string = '';
        let roleId: string = '';
        if (messageContent) {
            const hostMatches = messageContent.match(hostExpression);
            const trialeeMatches = messageContent.match(trialeeExpression);
            const roleMatches = messageContent.match(roleExpression);
            userId = hostMatches ? hostMatches[1] : '';
            trialeeId = trialeeMatches ? trialeeMatches[1] : '';
            roleId = roleMatches ? roleMatches[1] : '';
            if (!userId || !trialeeId || !roleId) {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription('Host, Trialee or Tag could not be detected.')
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        }
        if (hasRolePermissions) {
            const hasElevatedRole = await this.client.util.hasRolePermissions(this.client, ['moderator', 'admin', 'owner'], interaction);
            if ((interaction.user.id === userId) || hasElevatedRole) {
                const splitResults = messageContent?.split('⬥');
                if (!splitResults) {
                    replyEmbed.setColor(colours.discord.red)
                    replyEmbed.setDescription(`Message could not be parsed correctly.`)
                    return await interaction.editReply({ embeds: [replyEmbed] });
                }
                const messageContentWithoutStarted = splitResults[0];
                const dirtyStarted = splitResults[1];
                const started = dirtyStarted?.replace('> **Team**', '').trim();
                const newMessageContent = `${messageContentWithoutStarted}⬥ ${started}\n⬥ <@${trialeeId}> failed <t:${this.currentTime}:R>!\n\n> **Team**`;

                await this.saveTrial(interaction, trialeeId, roleId, userId, fields);

                const newEmbed = new EmbedBuilder()
                    .setColor(colours.discord.red)
                    .setFields(fields)
                    .setDescription(`${newMessageContent}`);
                await interaction.message.edit({ content: '', embeds: [newEmbed], components: [] });
                replyEmbed.setColor(colours.discord.green);
                replyEmbed.setDescription(`Trialee failed!`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                replyEmbed.setColor(colours.discord.red)
                replyEmbed.setDescription(`Only <@${userId}> or an elevated role can fail this trialee.`)
                return await interaction.editReply({ embeds: [replyEmbed] });
            }
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Fail Trialee, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    // ===============================
    // SUBMISSION APPROVAL SYSTEM
    // ===============================
    private async rejectDPM(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { colours, hasRolePermissions, hasOverridePermissions } = this.client.util;
        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'dpm');
        const replyEmbed: EmbedBuilder = new EmbedBuilder();

        if (rolePermissions || overridePermissions) {
            const messageEmbed: Embed = interaction.message.embeds[0];
            const footer = messageEmbed.footer;
            const submissionIdMatch = footer?.text.match(/Submission ID: (\d+)/);
            const submissionId = submissionIdMatch ? parseInt(submissionIdMatch[1], 10) : null;

            if (!submissionId) {
                replyEmbed.setColor(colours.discord.red).setDescription('Could not find a submission ID in the embed footer.');
                return await interaction.editReply({ embeds: [replyEmbed] });
            }

            const dpmSubmissionRepository = this.client.dataSource.getRepository(DpmSubmission);
            const submission = await dpmSubmissionRepository.findOneBy({ id: submissionId });

            if (!submission) {
                replyEmbed.setColor(colours.discord.red).setDescription(`A submission with the ID \`${submissionId}\` was not found.`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            }

            submission.status = 'rejected';
            await dpmSubmissionRepository.save(submission);

            const originalEmbed = new EmbedBuilder(messageEmbed.data)
                .setColor(colours.discord.red)
                .setFooter({ text: `Rejected by ${interaction.user.username} | Submission ID: ${submission.id}` })
                .setTimestamp();

            await interaction.message.edit({ embeds: [originalEmbed], components: [] });

            replyEmbed.setColor(colours.discord.green).setDescription('Submission rejected.');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Reject DPM, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async checkDpmLeaderboardPosition(submission: DpmSubmission): Promise<{ position: number; totalInCategory: number } | null> {
        const dpmSubmissionRepository = this.client.dataSource.getRepository(DpmSubmission);
        const leaderboardEligibleStyles = ['Hybrid', 'Tribrid', 'Necromancy'];

        if (!leaderboardEligibleStyles.includes(submission.style)) {
            return null;
        }

        const submissions = await dpmSubmissionRepository.find({
            where: {
                status: 'approved',
                teamSize: submission.teamSize,
                style: submission.style
            },
            order: { dpm: "DESC" }
        });

        const position = submissions.findIndex(s => s.id === submission.id) + 1;
        return position > 0 ? { position, totalInCategory: submissions.length } : null;
    }

    private async approveDPM(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { colours, hasRolePermissions, hasOverridePermissions } = this.client.util;
        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'dpm');
        const replyEmbed: EmbedBuilder = new EmbedBuilder();

        if (rolePermissions || overridePermissions) {
            const messageEmbed: Embed = interaction.message.embeds[0];
            const footer = messageEmbed.footer;
            const submissionIdMatch = footer?.text.match(/Submission ID: (\d+)/);
            const submissionId = submissionIdMatch ? parseInt(submissionIdMatch[1], 10) : null;

            if (!submissionId) {
                replyEmbed.setColor(colours.discord.red).setDescription('Could not find a submission ID in the embed footer.');
                return await interaction.editReply({ embeds: [replyEmbed] });
            }

            const dpmSubmissionRepository = this.client.dataSource.getRepository(DpmSubmission);
            const submission = await dpmSubmissionRepository.findOneBy({ id: submissionId });

            if (!submission) {
                replyEmbed.setColor(colours.discord.red).setDescription(`A submission with the ID \`${submissionId}\` was not found.`);
                return await interaction.editReply({ embeds: [replyEmbed] });
                }

            // Role assignment logic
            const removeHierarchy: RemoveHierarchy = {
                'adept': ['initiate'],
                'mastery': ['initiate', 'adept'],
                'extreme': ['mastery', 'initiate', 'adept'],
            };

            const { stripRole, getKeyFromValue } = this.client.util;
            const user = await interaction.guild?.members.fetch(submission.userId);
            let userAlreadyHadRole = false;

            if (user && submission.roleId) {
                // Check if user already has this role
                userAlreadyHadRole = user.roles.cache.has(submission.roleId);

                await user.roles.add(submission.roleId);

                // Remove inferior roles
                const roleKey = getKeyFromValue(getRoles(interaction.guild?.id), `<@&${submission.roleId}>`);
                if (roleKey in removeHierarchy) {
                    for await (const roleToRemove of removeHierarchy[roleKey]) {
                        const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                        if (user.roles.cache.has(removeRoleId)) await user.roles.remove(removeRoleId);
                    };
                }
            }

            submission.status = 'approved';
            submission.approvedBy = interaction.user.id;
            await dpmSubmissionRepository.save(submission);

            const originalEmbed = new EmbedBuilder(messageEmbed.data)
                .setColor(colours.discord.green)
                .setFooter({ text: `Approved by ${interaction.user.username} | Submission ID: ${submission.id}` })
                .setTimestamp();

            await interaction.message.edit({ embeds: [originalEmbed], components: [] });

            const dpmLeaderboards = await this.client.util.generateDpmLeaderboardEmbeds();
            try {
                const config = JSON.parse(await fs.readFile(leaderboardConfigPath, 'utf-8'));
                const message = await (this.client.channels.cache.get(config.channelId) as TextChannel).messages.fetch(config.messageId);
                await message.edit({ embeds: dpmLeaderboards });
            } catch (err) {
                this.client.logger.error({
                    message: 'Failed to update DPM leaderboard.',
                    error: err,
                    handler: this.constructor.name,
                });
            }

            const positionInfo = await this.checkDpmLeaderboardPosition(submission);
            const announcementChannel = await this.client.channels.fetch(getChannels(interaction.guild?.id).roleConfirmations) as TextChannel;

            if (announcementChannel) {
                if (submission.roleId && !userAlreadyHadRole) {
                    const roleEmbed = new EmbedBuilder()
                        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
                        .setTimestamp()
                        .setColor(this.client.color)
                        .setDescription(`Congratulations to <@${submission.userId}> on achieving <@&${submission.roleId}>!`);

                    const message = await announcementChannel.send({ embeds: [roleEmbed] });

                    const emojis = ['Pog', 'gz'];

                    for (let index = 0; index < emojis.length; index++) {
                        const emoji = await this.client.emojiCache.get(emojis[index]);

                        if (emoji) {
                            await message.react(emoji);
                        }
                    }
                }

                if (positionInfo && positionInfo.position <= 3) {
                    const positionEmojis = [this.client.util.emojis.gem1, this.client.util.emojis.gem2, this.client.util.emojis.gem3];
                    const leaderboardName = `\`${submission.teamSize} ${submission.style} DPM Leaderboard\``;
                    const submissionUser = await interaction.guild?.members.fetch(submission.userId);

                    const positionEmbed = new EmbedBuilder()
                        .setAuthor({
                            name: submissionUser?.user.username || 'Unknown User',
                            iconURL: submissionUser?.user.avatarURL() || undefined
                        })
                        .setDescription(`Congratulations to <@${submission.userId}> on achieving **Rank** ${positionEmojis[positionInfo.position - 1]} on the ${leaderboardName} with a DPM of **${submission.dpm.toFixed(2)}k**`)
                        .setTimestamp()
                        .setColor(this.client.color);

                    const message = await announcementChannel.send({ embeds: [positionEmbed] });

                    const emojis = ['Pog', 'gz'];

                    for (let index = 0; index < emojis.length; index++) {
                        const emoji = await this.client.emojiCache.get(emojis[index]);

                        if (emoji) {
                            await message.react(emoji);
                        }
                    }
                }
            }

            replyEmbed.setColor(colours.discord.green).setDescription('Submission approved.');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Approve DPM, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    // ===============================
    // REPORT SYSTEM
    // ===============================
    private async rejectReport(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { hasRolePermissions, hasOverridePermissions } = this.client.util;
        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'reports');

        if (rolePermissions || overridePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setColor(messageEmbed.color)
                .setDescription(`
                ${messageContent}\n
                > Report rejected by <@${this.userId}> <t:${this.currentTime}:R>.`);
            if (messageEmbed.image) newEmbed.setImage(messageEmbed.image.url);
            await interaction.message.edit({ embeds: [newEmbed], components: [] })
            const replyEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.green)
                .setDescription('Report successfully rejected!');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Reject Report, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async approveReport(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {

        interface CombinationParent {
            [roleKey: string]: string;
        }

        interface Categories {
            [category: string]: string[];
        }

        interface Prerequisites {
            [prerequisite: string]: Prerequisite
        }

        interface Prerequisite {
            [key: string]: string[]
        }

        const prerequisites: Prerequisites = {
            'duoRootskips': {
                'rootskips': ['threeSevenRootskips']
            },
            'threeSevenRootskips': {
                'rootskips': ['duoRootskips']
            },
            'duoExperienced': {
                'experienced': ['threeSevenExperienced']
            },
            'threeSevenExperienced': {
                'experienced': ['duoExperienced']
            },
            'duoMaster': {
                'master': ['threeSevenMaster']
            },
            'threeSevenMaster': {
                'master': ['duoMaster']
            },
            'duoGrandmaster': {
                'grandmaster': ['threeSevenGrandmaster']
            },
            'threeSevenGrandmaster': {
                'grandmaster': ['duoGrandmaster']
            }
        }

        const combinationParent: CombinationParent = {
            'duoRootskips': 'rootskips',
            'threeSevenRootskips': 'rootskips',
            'duoExperienced': 'experienced',
            'threeSevenExperienced': 'experienced',
            'duoMaster': 'master',
            'threeSevenMaster': 'master',
            'duoGrandmaster': 'grandmaster',
            'threeSevenGrandmaster': 'grandmaster'
        }

        const categories: Categories = {
            duo: ['noRealm', 'duoRootskips', 'duoExperienced', 'duoMaster', 'duoGrandmaster'],
            threeSeven: ['noRealm', 'threeSevenRootskips', 'threeSevenExperienced', 'threeSevenMaster', 'threeSevenGrandmaster'],
            combined: ['rootskips', 'experienced', 'master', 'grandmaster'],
        }

        const removeHierarchy: RemoveHierarchy = {
            'threeSevenRootskips': ['noRealm'],
            'duoExperienced': ['duoRootskips'],
            'threeSevenExperienced': ['threeSevenRootskips', 'noRealm'],
            'duoMaster': ['duoExperienced', 'duoRootskips'],
            'threeSevenMaster': ['threeSevenExperienced', 'threeSevenRootskips', 'noRealm'],
            'duoGrandmaster': ['duoMaster', 'duoExperienced', 'duoRootskips'],
            'threeSevenGrandmaster': ['threeSevenMaster', 'threeSevenExperienced', 'threeSevenRootskips', 'noRealm'],
            'rootskips': ['noRealm'],
            'experienced': ['noRealm', 'rootskips'],
            'master': ['noRealm', 'rootskips', 'experienced'],
            'grandmaster': ['noRealm', 'rootskips', 'experienced', 'master'],
        }

        const { stripRole, getKeyFromValue, categorize, hasRolePermissions, hasOverridePermissions } = this.client.util;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'reports');

        if (rolePermissions || overridePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const userIdRegex = messageContent?.match(/<@\d*\>/gm);
            const roleRegex = messageContent?.match(/<@&\d*\>/gm);
            let dirtySubmitterId;
            let dirtyReportedUserId;
            let dirtyRoleId;
            if (userIdRegex) dirtySubmitterId = userIdRegex[0];
            if (userIdRegex) dirtyReportedUserId = userIdRegex[1];
            if (roleRegex) dirtyRoleId = roleRegex[0];

            let embedMessage = '';
            let reportCount = 0;

            const sendRoleRemovalDM = async (user: GuildMember) => {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('Your role has been removed.')
                        .setColor(this.client.util.colours.discord.red)
                        .setDescription(`
                        Your role has been degraded due to multiple approved reports.
                        `);
                    await user.send({ embeds: [dmEmbed] });
                } catch {
                    this.client.logger.log(
                        {
                            message: `Attempted to send report role degradation notification. { user: ${user.id} }`,
                            handler: this.constructor.name,
                        },
                        true
                    );
                }
            }

            if (dirtySubmitterId && dirtyReportedUserId && dirtyRoleId) {
                let removeRole = false
                const { dataSource } = this.client;
                const repository = dataSource.getRepository(Report);
                const [_existingReports, reportsCount] = await repository.findAndCount({
                    where: {
                        reportedUser: dirtyReportedUserId,
                        role: dirtyRoleId,
                        expired: false
                    }
                })
                const report = new Report();
                report.reporter = dirtySubmitterId;
                report.reportedUser = dirtyReportedUserId;
                report.role = dirtyRoleId;
                report.link = interaction.message.url;
                await repository.save(report);

                removeRole = reportsCount + 1 >= 3 ? true : false;

                if (removeRole) {
                    await repository.update({ expired: false }, { expired: true });
                    reportCount = 3;
                    const roleKey = getKeyFromValue(getRoles(interaction.guild?.id), dirtyRoleId);
                    const category = categorize(roleKey);
                    const combinationKey = combinationParent[roleKey] ? combinationParent[roleKey] : '';
                    const roleId = stripRole(dirtyRoleId);
                    const combinationRoleId = combinationKey ? stripRole(getRoles(interaction.guild?.id)[combinationKey]) : '';
                    const userId = dirtyReportedUserId.slice(2, -1);
                    const user = await interaction.guild?.members.fetch(userId);
                    let userRoles = user?.roles.cache.map(role => role.id) || [];
                    let handled = false;
                    if (!userRoles.includes(roleId) && !userRoles.includes(combinationRoleId)) {
                        handled = true;
                        embedMessage = `This user does not have this role to remove.`;
                    }
                    if (userRoles.includes(roleId) && !combinationRoleId && !combinationKey) {
                        await user?.roles.remove(roleId);
                        userRoles = userRoles.filter(item => item !== roleId);
                        handled = true;
                        embedMessage = `${dirtyRoleId} was removed.\n`;
                        sendRoleRemovalDM(user);
                    }
                    if (userRoles.includes(roleId) && !userRoles.includes(combinationRoleId) && (handled === false)) {
                        await user?.roles.remove(roleId);
                        userRoles = userRoles.filter(item => item !== roleId);
                        const combinedCategoryIndex = categories.combined.indexOf(combinationKey);
                        const newCombinedCategoryIndex: number | null = combinedCategoryIndex !== 0 ? combinedCategoryIndex - 1 : null;
                        if ((newCombinedCategoryIndex !== null) && userRoles.includes(stripRole(getRoles(interaction.guild?.id)[categories.combined[newCombinedCategoryIndex]]))) {
                            embedMessage = `
                            ${dirtyRoleId} was removed.
                            <@${user.id}> already has <@&${getRoles(interaction.guild?.id)[categories[category][newCombinedCategoryIndex]]}>.
                            No degraded role was assigned.
                            `
                            sendRoleRemovalDM(user);
                        } else {
                            const reportedCategoryIndex = categories[category].indexOf(roleKey);
                            const newCategoryIndex: number | null = reportedCategoryIndex !== 0 ? reportedCategoryIndex - 1 : null;
                            if (newCategoryIndex !== null) {
                                const newRoleKey = categories[category][newCategoryIndex];
                                let anyAdditionalRole;
                                if (newRoleKey in prerequisites) {
                                    for (const key in prerequisites[newRoleKey]) {
                                        let assign = true;
                                        prerequisites[newRoleKey][key].forEach((prereqRole: string) => {
                                            const roleId = stripRole(getRoles(interaction.guild?.id)[prereqRole]);
                                            if (!(userRoles?.includes(roleId))) {
                                                assign = false;
                                            }
                                        })
                                        if (assign) {
                                            const assignedRoleId = stripRole(getRoles(interaction.guild?.id)[key]);
                                            if (!userRoles?.includes(assignedRoleId)) await user?.roles.add(assignedRoleId);
                                            prerequisites[newRoleKey][key].forEach((prereqRole: string) => {
                                                const roleId = stripRole(getRoles(interaction.guild?.id)[prereqRole]);
                                                if (userRoles?.includes(roleId)) user?.roles.remove(roleId);
                                            })
                                            if (key in removeHierarchy) {
                                                for await (const roleToRemove of removeHierarchy[key]) {
                                                    const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                                                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                                                };
                                            }
                                            if (newRoleKey in removeHierarchy) {
                                                for await (const roleToRemove of removeHierarchy[newRoleKey]) {
                                                    const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                                                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                                                };
                                            }
                                            anyAdditionalRole = key;
                                        } else {
                                            const roleId = stripRole(getRoles(interaction.guild?.id)[newRoleKey]);
                                            if (!userRoles?.includes(roleId)) user?.roles.add(roleId);
                                            if (newRoleKey in removeHierarchy) {
                                                for await (const roleToRemove of removeHierarchy[newRoleKey]) {
                                                    const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                                                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                                                };
                                            }
                                        }
                                    }
                                } else {
                                    const roleId = stripRole(getRoles(interaction.guild?.id)[newRoleKey]);
                                    if (!userRoles?.includes(roleId)) await user?.roles.add(roleId);
                                    if (newRoleKey in removeHierarchy) {
                                        for await (const roleToRemove of removeHierarchy[newRoleKey]) {
                                            const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
                                            if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                                        };
                                    }
                                }
                                embedMessage = `${dirtyRoleId} was degraded into ${anyAdditionalRole ? `${getRoles(interaction.guild?.id)[anyAdditionalRole]}` : `${getRoles(interaction.guild?.id)[newRoleKey]}`}.\n`;
                                sendRoleRemovalDM(user);
                            }
                        }
                        handled = true;
                    }
                    if (userRoles.includes(combinationRoleId) && (handled === false)) {
                        const hasHigherRole = (role: string) => {
                            try {
                                if (!categorize(role)) return false;
                                const categorizedHierarchy = categories[categorize(role)];
                                const sliceFromIndex: number = categorizedHierarchy.indexOf(role) + 1;
                                const hierarchyList = categorizedHierarchy.slice(sliceFromIndex);
                                const hierarchyIdList = hierarchyList.map((item: string) => stripRole(getRoles(interaction.guild?.id)[item]));
                                const intersection = hierarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
                                if (intersection.length === 0) {
                                    return false
                                } else {
                                    return true
                                };
                            }
                            catch (err) { return false }
                        }
                        await user?.roles.remove(combinationRoleId);
                        userRoles = userRoles.filter(item => item !== combinationRoleId);
                        let degradedRoleAdded = false;
                        let oppositeRoleAdded = false;
                        const reportedCategoryIndex = categories[category].indexOf(roleKey);
                        const newCategoryIndex: number | null = reportedCategoryIndex !== 0 ? reportedCategoryIndex - 1 : null;
                        if (newCategoryIndex === null) {
                            embedMessage = `There is no role to degrade to.`
                        } else if (newCategoryIndex >= 0) {
                            const degradedRoleKey = categories[category][newCategoryIndex];
                            const degradedRoleId = stripRole(getRoles(interaction.guild?.id)[degradedRoleKey]);
                            if (!hasHigherRole(degradedRoleKey)) {
                                await user?.roles.add(degradedRoleId);
                                degradedRoleAdded = true;
                            }

                            const oppositeRoleKey = prerequisites[roleKey][combinationKey][0];
                            const oppositeRoleId = stripRole(getRoles(interaction.guild?.id)[oppositeRoleKey]);
                            if (!hasHigherRole(oppositeRoleKey)) {
                                await user?.roles.add(oppositeRoleId);
                                oppositeRoleAdded = true;
                            }
                            embedMessage = `
                            <@&${combinationRoleId}> was removed.
                            ${degradedRoleAdded ? `<@&${degradedRoleId}> was assigned.` : ''}
                            ${oppositeRoleAdded ? `<@&${oppositeRoleId}> was also assigned.` : ''}
                            `;
                            sendRoleRemovalDM(user);
                        }
                    }
                } else {
                    reportCount = reportsCount + 1;
                }
            }

            const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setColor(messageEmbed.color)
                .setDescription(`
                ${messageContent}
                ${embedMessage ? embedMessage : ''}${dirtyReportedUserId ? `${dirtyReportedUserId} now has **${reportCount}** report${reportCount !== 1 ? 's' : ''} for ${dirtyRoleId}.\n` : ''}
                > Report approved by <@${this.userId}> <t:${this.currentTime}:R>.`);
            if (messageEmbed.image) newEmbed.setImage(messageEmbed.image.url);
            await interaction.message.edit({ embeds: [newEmbed], components: [] })
            const replyEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.green)
                .setDescription('Report successfully applied!');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Approve Report, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async rejectRoleAssign(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { hasOverridePermissions, hasRolePermissions } = this.client.util;

        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'assign');

        if (rolePermissions || overridePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setColor(messageEmbed.color)
                .setDescription(`${messageContent}\n\n> Role Rejected by <@${this.userId}> <t:${this.currentTime}:R>.`);
            const assignedRoles = messageContent?.match(/<@&\d*\>/gm)?.map(unstrippedRole => this.client.util.stripRole(unstrippedRole));
            const userIdRegex = messageContent?.match(/to <@\d*\>/gm);
            const messageIdRegex = messageContent?.match(/\[\d*\]/gm)
            let dirtyUserId;
            let dirtyMessageId;
            if (!assignedRoles) return;
            if (userIdRegex) dirtyUserId = userIdRegex[0];
            if (messageIdRegex) dirtyMessageId = messageIdRegex[0];
            if (dirtyUserId) {
                const userId = dirtyUserId.slice(5, -1);
                const user = await interaction.guild?.members.fetch(userId);
                for await (const assignedId of assignedRoles) {
                    await user.roles.remove(assignedId);
                };
            }
            if (dirtyMessageId && messageContent) {
                try {
                    const messageId = dirtyMessageId.slice(1, -1);
                    const channelId = messageContent.split('/channels/')[1].split('/')[1];
                    const channel = await interaction.guild.channels.fetch(channelId) as TextChannel;
                    const message = await channel.messages.fetch(messageId);
                    await message.delete();
                }
                catch (err) { }
            }
            await interaction.message.edit({ embeds: [newEmbed], components: [] })
            const replyEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.green)
                .setDescription('Role successfully rejected!');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Reject Role Assign, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async rejectKillTime(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { colours, hasRolePermissions, hasOverridePermissions } = this.client.util;
        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'killtime');
        const replyEmbed: EmbedBuilder = new EmbedBuilder();

        if (rolePermissions || overridePermissions) {
            const messageEmbed: Embed = interaction.message.embeds[0];
            const footer = messageEmbed.footer;
            const submissionIdMatch = footer?.text.match(/Submission ID: (\d+)/);
            const submissionId = submissionIdMatch ? parseInt(submissionIdMatch[1], 10) : null;

            if (!submissionId) {
                replyEmbed.setColor(colours.discord.red).setDescription('Could not find a submission ID in the embed footer.');
                return await interaction.editReply({ embeds: [replyEmbed] });
            }

            const killTimeSubmissionRepository = this.client.dataSource.getRepository(KillTimeSubmission);
            const submission = await killTimeSubmissionRepository.findOneBy({ id: submissionId });

            if (!submission) {
                replyEmbed.setColor(colours.discord.red).setDescription(`A submission with the ID \`${submissionId}\` was not found.`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            }

            submission.status = 'rejected';
            submission.approvedBy = interaction.user.id;
            await killTimeSubmissionRepository.save(submission);

            const originalEmbed = new EmbedBuilder(messageEmbed.data)
                .setColor(colours.discord.red)
                .setFooter({ text: `Rejected by ${interaction.user.username} | Submission ID: ${submission.id}` })
                .setTimestamp();

            await interaction.message.edit({ embeds: [originalEmbed], components: [] });

            replyEmbed.setColor(colours.discord.green).setDescription('Submission rejected.');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Reject DPM, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async approveKillTime(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { colours, hasRolePermissions, hasOverridePermissions } = this.client.util;
        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'killtime');
        const replyEmbed: EmbedBuilder = new EmbedBuilder();

        if (rolePermissions || overridePermissions) {
            const messageEmbed: Embed = interaction.message.embeds[0];
            const footer = messageEmbed.footer;
            const submissionIdMatch = footer?.text.match(/Submission ID: (\d+)/);
            const submissionId = submissionIdMatch ? parseInt(submissionIdMatch[1], 10) : null;

            if (!submissionId) {
                replyEmbed.setColor(colours.discord.red).setDescription('Could not find a submission ID in the embed footer.');
                return await interaction.editReply({ embeds: [replyEmbed] });
            }

            const killTimeSubmissionRepository = this.client.dataSource.getRepository(KillTimeSubmission);
            const submission = await killTimeSubmissionRepository.findOneBy({ id: submissionId });

            if (!submission) {
                replyEmbed.setColor(colours.discord.red).setDescription(`A submission with the ID \`${submissionId}\` was not found.`);
                return await interaction.editReply({ embeds: [replyEmbed] });
            }

            submission.status = 'approved';
            submission.approvedBy = interaction.user.id;
            await killTimeSubmissionRepository.save(submission);

            const originalEmbed = new EmbedBuilder(messageEmbed.data)
                .setColor(colours.discord.green)
                .setFooter({ text: `Approved by ${interaction.user.username} | Submission ID: ${submission.id}` })
                .setTimestamp();

            await interaction.message.edit({ embeds: [originalEmbed], components: [] });

            const killTimeLeaderboard = await this.client.util.generateKillTimeLeaderboardEmbed();
                try {
                const config = JSON.parse(await fs.readFile(killTimeLeaderboardConfigPath, 'utf-8'));
                const message = await (this.client.channels.cache.get(config.channelId) as TextChannel).messages.fetch(config.messageId);
                await message.edit({ embeds: [killTimeLeaderboard] });
            } catch (err) {
                this.client.logger.error({
                    message: 'Failed to update Kill Time leaderboard.',
                    error: err,
                    handler: this.constructor.name,
                });
            }

            replyEmbed.setColor(colours.discord.green).setDescription('Submission approved.');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Approve DPM, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    // ===============================
    // UTILITY METHODS
    // ===============================
    public async grantTrialRole(interaction: ButtonInteraction<'cached'>, cleanRoleId: string, trialeeId: string) {
        const { stripRole, getKeyFromValue } = this.client.util;
        const roleKey = getKeyFromValue(getRoles(interaction.guild?.id), `<@&${cleanRoleId}>`);
        const roleId = stripRole(getRoles(interaction.guild?.id)[roleKey]);
        const user = await interaction.guild.members.fetch(trialeeId);
        if (!user.roles.cache.has(roleId)) {
            await user.roles.add(roleId);
        }
    }

    // ===============================
    // SELF-ASSIGN SYSTEM
    // ===============================
    private async handleSelfAssign(interaction: ButtonInteraction<'cached'>, id: string) : Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const { colours } = this.client.util;
        const user = await interaction.guild?.members.fetch(interaction.user.id);
        const userRoles = await user?.roles.cache.map(role => role.id) || [];

        const roleIds: string[] = id.split(";");
        let roleReqError: string = "";
        const addResultEmbed = new EmbedBuilder()
            .setColor(colours.discord.green)
            .setDescription(`<@&${roleIds[0]}> successfully applied.`);

        const removeResultEmbed = new EmbedBuilder()
            .setColor(colours.discord.green)
            .setDescription(`<@&${roleIds[0]}> successfully removed.`);

        const roleObject = interaction.guild.roles.cache.get(roleIds[0]);

        if (roleObject?.permissions.has('ManageRoles')) {
            return await interaction.editReply({embeds: [new EmbedBuilder()
                .setColor(colours.discord.red)
                .setDescription(`Unallowed Role-Assign!`)]});
        }

        if (userRoles.includes(roleIds[0])) {
            await user.roles.remove(roleIds[0]);
            await this.client.logReactionRoleChange(user, roleObject!, 'removed');
            return await interaction.editReply({embeds: [removeResultEmbed]});
        } else if (roleIds.length == 1) {
            if (!userRoles.includes(roleIds[0])) {
                await user.roles.add(roleIds[0]);
                await this.client.logReactionRoleChange(user, roleObject!, 'added');
                return await interaction.editReply({embeds: [addResultEmbed]});
            }
        } else if (roleIds.length > 1) {
            const { categorize, stripRole, hierarchy } = this.client.util;

            //special logic for hierarchy tags
            const hasRoleOrHigher = (role: string) => {
                try {
                    if (!categorize(role) || categorize(role) === 'vanity' || categorize(role) === '') return false;
                    const categorizedHierarchy = hierarchy[categorize(role)];
                    const sliceFromIndex: number = categorizedHierarchy.indexOf(role);
                    const hierarchyList = categorizedHierarchy.slice(sliceFromIndex);
                    const hierarchyIdList = hierarchyList.map((item: string) => stripRole(getRoles(interaction.guild?.id)[item]));
                    const intersection = hierarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
                    if (intersection.length === 0) {
                        return false
                    } else {
                        return true
                    };
                }
                catch (err) { return false }
            }

            //check for required tags
            for (let i = 1; i < roleIds.length; i++) {
                if (!/^[+-]?\d+(\.\d+)?$/.test(roleIds[i])) {
                    if (hasRoleOrHigher(roleIds[i])) {
                    await user.roles.add(roleIds[0]);
                        await this.client.logReactionRoleChange(user, roleObject!, 'added');
                    return await interaction.editReply({embeds: [addResultEmbed]});
                    } else {
                        if (i > 1) {
                            roleReqError += ", ";
                        }

                        roleReqError += getRoles(interaction.guild?.id)[roleIds[i]];
                    }
                } else {
                    if (userRoles.includes(roleIds[i])) {
                        await user.roles.add(roleIds[0]);
                        await this.client.logReactionRoleChange(user, roleObject!, 'added');
                        return await interaction.editReply({embeds: [addResultEmbed]});
                    }
                    if (i > 1) {
                        roleReqError += ", ";
                    }

                    roleReqError += `<@&${roleIds[i]}>`;
                }
            }

            if (roleReqError) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(colours.discord.red)
                    .setDescription(`You need any of the following tags to set this colour!\nTags:${roleReqError}`);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    }

    // ===============================
    // PUBLIC HOSTING
    // ===============================
    private async handleHost(interaction: ButtonInteraction<'cached'>, id: string) : Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { colours, cleanContainer } = this.client.util;
        const cleanUp = cleanContainer.bind(this.client.util)

        let roleName = id;
        let componentIndex = -1;

        switch (id) {
            case 'Base':
                componentIndex = 0;
                break;
            case '11':
                roleName = 'Role 1';
                componentIndex = 2;
                break;
            case '12':
                roleName = 'Role 1';
                componentIndex = 4;
                break;
            case '21':
                roleName = 'Role 2';
                componentIndex = 6;
                break;
            case '22':
                roleName = 'Role 2';
                componentIndex = 8;
                break;
        }

        const messageComponents = (interaction.message.components[0] as ContainerComponent).components;
        const container = cleanUp(interaction.message.components[0]);
        const replyEmbed = new EmbedBuilder();

        let offset = 0;
        if (messageComponents.length === 11) {
            offset = 2;
            componentIndex += 2;
        }

        const getSignedUpIndex = (userid: string) => {
            for (let index = 0; index <= 8; index+=2) {
                const element = ((messageComponents[index + offset] as SectionComponent).components[0] as TextDisplayComponent).content;

                if (element.includes(userid)) {
                    return index + offset;
                }
            }
            return -1;
        };

        const isSlotTaken = (index: number) => {
            const element = ((messageComponents[index + offset] as SectionComponent).components[0] as TextDisplayComponent).content;

            if (element.includes('`Empty`')) {
                return false;
            }

            return true;
        };

        //check if user is already signed up somewhere
        const signedUpIndex = getSignedUpIndex(interaction.user.id);

        if (signedUpIndex >= 0 && signedUpIndex === componentIndex) {
            // user is signed up - unassign
            const value = (((messageComponents[componentIndex] as SectionComponent).components[0] as TextDisplayComponent).content).replace(`<@${interaction.user.id}>`, '`Empty`');
            (container.components[componentIndex] as SectionBuilder).components[0] = new TextDisplayBuilder().setContent(value);
            await interaction.message.edit( { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });

            replyEmbed.setColor(colours.discord.green).setDescription(`Successfully unassigned from **${roleName}**.`);
        } else if (signedUpIndex >= 0) {
            // user is signed up elsewhere
            replyEmbed.setColor(colours.discord.red).setDescription('You are signed up as a different role. Unassign from that role first.');
        } else {
            // check if signup is possible
            if (isSlotTaken(componentIndex)) {
                //error
                replyEmbed.setColor(colours.discord.red).setDescription(`**${roleName}** is already taken.`);
            } else {
                // signup
                const value = (((messageComponents[componentIndex] as SectionComponent).components[0] as TextDisplayComponent).content).replace('`Empty`', `<@${interaction.user.id}>`);
                (container.components[componentIndex] as SectionBuilder).components[0] = new TextDisplayBuilder().setContent(value);
                await interaction.message.edit( { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });

                replyEmbed.setColor(colours.discord.green).setDescription(`Successfully assigned to **${roleName}**.`);
            }
        }

        return await interaction.editReply({ embeds: [replyEmbed] });
    }
}
