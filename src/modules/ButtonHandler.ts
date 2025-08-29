import { ButtonInteraction, EmbedBuilder, InteractionResponse, Message, TextChannel, MessageFlags, ContainerComponent, TextDisplayComponent, SectionComponent, SectionBuilder, TextDisplayBuilder } from 'discord.js';
import Bot from '../Bot';
import TicketHandler from './TicketHandler';
import { getRoles } from '../GuildSpecifics';
import LeaderboardHandler from './LeaderboardHandler';

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

        if (id.startsWith('leaderboard_')) {
            new LeaderboardHandler(this.client, interaction.customId, interaction);
            return;
        }

        if (id.startsWith('tempvc_')) {
            this.client.tempManager?.handleTempVcDashboardInteraction(interaction);
            return;
        }

        switch (id) {
            case 'rejectRoleAssign': this.rejectRoleAssign(interaction); break;
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


    //#region Role-Assign

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

    //#endregion

    //#region SELF-ASSIGN SYSTEM
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
            const { categorize, hierarchy, enrageHierarchy } = this.client.util;

            //special logic for hierarchy tags
            const hasRoleOrHigher = (role: string) => {
                try {
                    if (!categorize(role) || categorize(role) === 'vanity' || categorize(role) === '') return false;

                    //special logic for enrage roles
                    if (categorize(role) === 'enrage') {
                        const whitelist = enrageHierarchy[role];
                        const whitelistIds = whitelist.map((item: string) => getRoles(interaction.guild.id, true)[item]);
                        const intersection = whitelistIds.filter((roleId: string) => userRoles.includes(roleId));
                        if (intersection.length === 0) {
                            return false;
                        }
                        return true;
                    } else {
                        const categorizedHierarchy = hierarchy[categorize(role)];
                        const sliceFromIndex: number = categorizedHierarchy.indexOf(role);
                        const hierarchyList = categorizedHierarchy.slice(sliceFromIndex);
                        const hierarchyIdList = hierarchyList.map((item: string) => getRoles(interaction.guild?.id, true)[item]);
                        const intersection = hierarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
                        if (intersection.length === 0) {
                            return false
                        }
                        return true;
                    }
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
                        // go through whitelist
                        if (categorize(roleIds[i]) === 'enrage') {
                            const whitelist = enrageHierarchy[roleIds[i]];
                            const whitelistMentions = whitelist.map((item: string) => getRoles(interaction.guild.id, false)[item]);

                            roleReqError += whitelistMentions.join(', ');
                            continue;
                        }

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

    //#endregion

    //#region HOSTING

    private async handleHost(interaction: ButtonInteraction<'cached'>, id: string) : Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { colours, cleanContainer } = this.client.util;
        const cleanUp = cleanContainer.bind(this.client.util)

        let roleName = id;
        let targetSlot = '';

        switch (id) {
            case 'Base':
                roleName = 'Base';
                targetSlot = '**Base:**';
                break;
            case '11':
                roleName = 'Role 1';
                targetSlot = '**Role 1:**';
                break;
            case '12':
                roleName = 'Role 1';
                targetSlot = '**Role 1:**';
                break;
            case '21':
                roleName = 'Role 2';
                targetSlot = '**Role 2:**';
                break;
            case '22':
                roleName = 'Role 2';
                targetSlot = '**Role 2:**';
                break;
        }

        const messageComponents = (interaction.message.components[0] as ContainerComponent).components;
        const container = cleanUp(interaction.message.components[0]);
        const replyEmbed = new EmbedBuilder();

        // Find all section components that match our target role
        const getSectionIndices = (rolePattern: string) => {
            const indices: number[] = [];
            for (let i = 0; i < messageComponents.length; i++) {
                const component = messageComponents[i];
                if (component.type === 9 &&
                    (component as SectionComponent).components?.[0]?.type === 10) {
                    const content = ((component as SectionComponent).components[0] as TextDisplayComponent).content;
                    if (content.includes(rolePattern)) {
                        indices.push(i);
                    }
                }
            }
            return indices;
        };

        const getSignedUpIndex = (userid: string) => {
            for (let i = 0; i < messageComponents.length; i++) {
                const component = messageComponents[i];
                if (component.type === 9 &&
                    (component as SectionComponent).components?.[0]?.type === 10) {
                    const content = ((component as SectionComponent).components[0] as TextDisplayComponent).content;
                    if (content.includes(userid)) {
                        return i;
                    }
                }
            }
            return -1;
        };

        const isSlotTaken = (index: number) => {
            if (index < 0 || index >= messageComponents.length) return true;

            const component = messageComponents[index];
            if (component.type !== 9 ||
                !(component as SectionComponent).components?.[0] ||
                (component as SectionComponent).components[0].type !== 10) {
                return true;
            }

            const content = ((component as SectionComponent).components[0] as TextDisplayComponent).content;
            return !content.includes('`Empty`');
        };

        // Find the specific slot index for this button press
        const sectionIndices = getSectionIndices(targetSlot);
        let componentIndex = -1;

        if (targetSlot === '**Base:**') {
            componentIndex = sectionIndices[0] ?? -1;
        } else if (targetSlot === '**Role 1:**') {
            if (id === '11') {
                componentIndex = sectionIndices[0] ?? -1;
            } else if (id === '12') {
                componentIndex = sectionIndices[1] ?? -1;
            }
        } else if (targetSlot === '**Role 2:**') {
            if (id === '21') {
                componentIndex = sectionIndices[0] ?? -1;
            } else if (id === '22') {
                componentIndex = sectionIndices[1] ?? -1;
            }
        }

        // Check if we found a valid component index
        if (componentIndex === -1) {
            replyEmbed.setColor(colours.discord.red).setDescription('Unable to find the requested slot. The host card may be malformed.');
            return await interaction.editReply({ embeds: [replyEmbed] });
        }

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

    //#endregion
}
