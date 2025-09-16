import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, Interaction, MessageFlags, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, SeparatorSpacingSize, TextChannel, TextInputBuilder, TextInputStyle, ThreadAutoArchiveDuration, User } from 'discord.js';
import Bot from '../Bot';
import axios from 'axios';
import TranscriptGenerator from './TranscriptGenerator';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Ticket } from '../entity/Ticket';
import { Warning } from '../entity/Warning';
import UtilityHandler from './UtilityHandler';

export default interface TicketHandler { client: Bot; id: string; interaction: Interaction }

export default class TicketHandler {
    constructor(client: Bot, id: string, interaction: Interaction) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        if (interaction.isModalSubmit()) {
            this.handleTicketModalSubmit(interaction);
        }

        if (interaction.isChatInputCommand()) {
            switch (interaction.commandName) {
                case 'create-clearance-ticket': this.handleCreateClearanceTicket(interaction as ChatInputCommandInteraction); break;
            }
        }

        if (id.startsWith('ticket:download_transcript_')) {
            const forumPostId = id.substring('ticket:download_transcript_'.length);
            this.client.logger.log({
                message: `[ButtonHandler] Matched transcript download button. Forum post ID: "${forumPostId}"`,
                handler: this.constructor.name
            }, true);
            this.handleTranscriptDownload(interaction as ButtonInteraction<'cached'>, forumPostId);
            return;
        }

        switch (id) {
            case 'ticket:create_suggestion': this.handleTicketSuggestion(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_report': this.handleTicketReport(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_contentcreator': this.handleTicketContentCreator(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_other': this.handleTicketOther(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_learner': this.handleTicketLearner(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_librarian': this.handleTicketLibrarian(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_support': this.handleTicketSupport(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_teacher': this.handleTicketTeacher(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_trialteam': this.handleTicketTrialTeam(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket_close': this.handleTicketClose(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket_close_confirm': this.handleTicketCloseConfirm(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket_close_cancel': this.handleTicketCloseCancel(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket_open': this.handleTicketOpen(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket_delete': this.handleTicketDelete(interaction as ButtonInteraction<'cached'>); break;
        }
    }

    //#region MODAL HANDLERS
    private async handleTicketSuggestion(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_suggestion_${interaction.user.id}`)
            .setTitle('Submit a Suggestion');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestion')
            .setLabel('Briefly describe your suggestion')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Why do you think your suggestion would work?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(suggestionInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

        modal.addComponents(firstRow, secondRow, thirdRow);
        await interaction.showModal(modal);
    }

    private async handleTicketReport(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_report_${interaction.user.id}`)
            .setTitle('Submit a Report');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const reportedUserInput = new TextInputBuilder()
            .setCustomId('reported_user')
            .setLabel('RSN & Discord User you are reporting')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('What is the reason for your report?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Briefly describe the issue.')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reportedUserInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
        const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
        await interaction.showModal(modal);
    }

    private async handleTicketContentCreator(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_contentcreator_${interaction.user.id}`)
            .setTitle('Content Creator Application');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const platformInput = new TextInputBuilder()
            .setCustomId('platform_url')
            .setLabel("What's your streaming platform URL?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200);

        const additionalInput = new TextInputBuilder()
            .setCustomId('additional')
            .setLabel("Anything else you'd like to add?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(platformInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(additionalInput);

        modal.addComponents(firstRow, secondRow, thirdRow);
        await interaction.showModal(modal);
    }

    private async handleTicketOther(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_other_${interaction.user.id}`)
            .setTitle('Other Support Request');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const assistanceInput = new TextInputBuilder()
            .setCustomId('assistance')
            .setLabel('How can we assist you?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(assistanceInput);

        modal.addComponents(firstRow, secondRow);
        await interaction.showModal(modal);
    }

    private async handleTicketLearner(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_learner_${interaction.user.id}`)
            .setTitle('Learner Request');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Timezone and Game Times Active')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const confirmInput = new TextInputBuilder()
            .setCustomId('confirm')
            .setLabel('Confirm you\'ve read & understand requirements')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const assistanceInput = new TextInputBuilder()
            .setCustomId('goals')
            .setLabel('What are you hoping to get out of this ticket')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const secretWordInput = new TextInputBuilder()
            .setCustomId('secretWord')
            .setLabel('Provide secret word')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(timezoneInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(confirmInput);
        const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(assistanceInput);
        const fifthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(secretWordInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);
        await interaction.showModal(modal);
    }

    private async handleTicketLibrarian(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_librarian_${interaction.user.id}`)
            .setTitle('Librarian staff application');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Timezone and Game Times active')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonsInput = new TextInputBuilder()
            .setCustomId('reasons')
            .setLabel('Why are you applying for this role?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);


        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(timezoneInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonsInput);

        modal.addComponents(firstRow, secondRow, thirdRow);
        await interaction.showModal(modal);
    }

    private async handleTicketSupport(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_support_${interaction.user.id}`)
            .setTitle('Support team staff application');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Timezone and Game Times active')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonsInput = new TextInputBuilder()
            .setCustomId('reasons')
            .setLabel('Why are you applying for this role?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(timezoneInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonsInput);

        modal.addComponents(firstRow, secondRow, thirdRow);
        await interaction.showModal(modal);
    }

    private async handleTicketTeacher(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_teacher_${interaction.user.id}`)
            .setTitle('Teacher staff application');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Timezone and Game Times active')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const enrageInput = new TextInputBuilder()
            .setCustomId('enrage')
            .setLabel('Which enrage do you want to teach people')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const presetKcInput = new TextInputBuilder()
            .setCustomId('presetkc')
            .setLabel('Please provide your preset and kc')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonsInput = new TextInputBuilder()
            .setCustomId('reasons')
            .setLabel('Why are you applying for this role?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(timezoneInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(enrageInput);
        const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(presetKcInput);
        const fifthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonsInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);
        await interaction.showModal(modal);
    }

    private async handleTicketTrialTeam(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_trialteam_${interaction.user.id}`)
            .setTitle('Trial Team staff application');

        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setLabel('Your RSN (RuneScape Name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Timezone and Game Times active')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const enrageInput = new TextInputBuilder()
            .setCustomId('enrage')
            .setLabel('Which enrage do you want to trial people')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const presetKcInput = new TextInputBuilder()
            .setCustomId('presetkc')
            .setLabel('Please provide your preset and kc')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonsInput = new TextInputBuilder()
            .setCustomId('reasons')
            .setLabel('Why are you applying for this role?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rsnInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(timezoneInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(enrageInput);
        const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(presetKcInput);
        const fifthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonsInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);
        await interaction.showModal(modal);
    }

    private async handleTicketModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ ephemeral: true });

        try {
            const customIdParts = interaction.customId.split('_');
            const ticketType = customIdParts[1];
            const userId = customIdParts[2];

            if (userId !== interaction.user.id) {
                await interaction.editReply({ content: 'This modal is not for you.' });
                return;
            }

            const formData: any = {};
            formData.rsn = interaction.fields.getTextInputValue('rsn');

            switch (ticketType) {
                case 'report':
                    formData.reported_user = interaction.fields.getTextInputValue('reported_user');
                    formData.reason = interaction.fields.getTextInputValue('reason');
                    formData.description = interaction.fields.getTextInputValue('description');
                    break;
                case 'suggestion':
                    formData.suggestion = interaction.fields.getTextInputValue('suggestion');
                    formData.reason = interaction.fields.getTextInputValue('reason');
                    break;
                case 'contentcreator':
                    formData.platform_url = interaction.fields.getTextInputValue('platform_url');
                    formData.additional = interaction.fields.getTextInputValue('additional');
                    break;
                case 'other':
                    formData.assistance = interaction.fields.getTextInputValue('assistance');
                    break;
                case 'learner':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.confirm = interaction.fields.getTextInputValue('confirm');
                    formData.goals = interaction.fields.getTextInputValue('goals');
                    formData.secretWord = interaction.fields.getTextInputValue('secretWord');
                    break;
                case 'librarian':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.reasons = interaction.fields.getTextInputValue('reasons');
                    break;
                case 'support':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.reasons = interaction.fields.getTextInputValue('reasons');
                    break;
                case 'teacher':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.reasons = interaction.fields.getTextInputValue('reasons');
                    formData.presetkc = interaction.fields.getTextInputValue('presetkc');
                    formData.enrage = interaction.fields.getTextInputValue('enrage');
                    break;
                case 'trialteam':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.reasons = interaction.fields.getTextInputValue('reasons');
                    formData.presetkc = interaction.fields.getTextInputValue('presetkc');
                    formData.enrage = interaction.fields.getTextInputValue('enrage');
                    break;
            }

            const ticketNumber = await this.getNextTicketNumber(ticketType);

            const ticketChannel = await this.createTicketChannel(
                interaction.guild,
                ticketType,
                interaction.user.id,
                ticketNumber
            );

            if (!ticketChannel) {
                await interaction.editReply({
                    content: 'Failed to create ticket channel. Please try again or contact an administrator.'
                });
                return;
            }

            await this.sendTicketWelcomeMessage(
                ticketChannel,
                interaction.user.id,
                ticketType,
                formData
            );

            await this.saveTicketSubmit(interaction.user.id, ticketChannel.id, ticketType);

            await interaction.editReply({
                content: `Your ticket has been created! Please check <#${ticketChannel.id}> for further assistance.`
            });

        } catch (error) {
            this.client.logger.error({
                message: 'Failed to handle ticket modal submission',
                error,
                handler: 'InteractionHandler'
            });

            await interaction.editReply({
                content: 'An error occurred while creating your ticket. Please try again or contact an administrator.'
            });
        }
    }

    //#endregion

    //#region Command Handlers

    private async handleCreateClearanceTicket(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ ephemeral: true });

        try {
            const reportedUser: User = interaction.options.getUser('reporteduser', true);
            const rsn: string = interaction.options.getString('rsn', true);
            const description: string = interaction.options.getString('description', true);

            const formData: any = {};
            formData.rsn = rsn;
            formData.discordid = reportedUser.id;
            formData.description = description;

            const ticketNumber = await this.getNextTicketNumber('clearance');

            const ticketChannel = await this.createTicketChannel(
                interaction.guild,
                'clearance',
                reportedUser.id,
                ticketNumber
            );

            if (!ticketChannel) {
                await interaction.editReply({
                    content: 'Failed to create ticket channel. Please try again or contact an administrator.'
                });
                return;
            }

            await this.sendTicketWelcomeMessage(
                ticketChannel,
                interaction.user.id,
                'clearance',
                formData
            );

            await this.saveTicketSubmit(interaction.user.id, ticketChannel.id, 'clearance');

            await interaction.editReply({
                content: `Your ticket has been created! Please check <#${ticketChannel.id}> for further assistance.`
            });

        } catch (error) {
            this.client.logger.error({
                message: 'Failed to handle ticket clearance creation',
                error,
                handler: 'TicketHandler'
            });

            await interaction.editReply({
                content: 'An error occurred while creating your ticket. Please try again or contact an administrator.'
            });
        }
    }

    //#endregion

    //#region CLOSE HANDLERS
    private async handleTicketClose(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const channelName = interaction.channel?.name;
        if (!channelName || !channelName.includes('-')) {
            await interaction.reply({ content: 'This command can only be used in ticket channels.', flags: MessageFlags.Ephemeral });
            return;
        }

        const hasPermission = await this.canCloseTicket(interaction);
        if (!hasPermission) {
            await interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });
            return;
        }
        const confirmEmbed = new EmbedBuilder()
            .setTitle('Close Ticket')
            .setDescription('Are you sure you would like to close this ticket?')
            .setColor(0xff9999);

        const confirmButtons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_close_confirm')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_close_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({ embeds: [confirmEmbed], components: [confirmButtons], flags: MessageFlags.Ephemeral });
    }

    private async handleTicketCloseConfirm(interaction: ButtonInteraction<'cached'>): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const channel = interaction.channel as TextChannel;

            let ticketUserId: string | null = null;

            const messages = await UtilityHandler.readAllMessages(channel);
            const welcomeMessage = messages.find(msg =>
                msg.content && (
                    msg.content.includes('your ticket has been created') ||
                    msg.content.includes('ticket has been created')
                ) && msg.content.match(/<@(\d+)>/)
            );

            if (welcomeMessage) {
                const userIdMatch = welcomeMessage.content.match(/<@(\d+)>/);
                if (userIdMatch) {
                    ticketUserId = userIdMatch[1];
                }
            }

            if (!ticketUserId) {
                for (const [id, overwrite] of channel.permissionOverwrites.cache) {
                    if (overwrite.type === 1 && overwrite.allow.has('ViewChannel')) {
                        const adminRoleId = this.client.roleIds.admin;
                        const ownerRoleId = this.client.roleIds.owner;

                        if (id !== adminRoleId && id !== ownerRoleId && id !== this.client.user?.id) {
                            ticketUserId = id;
                            break;
                        }
                    }
                }
            }

            if (ticketUserId) {
                await channel.permissionOverwrites.delete(ticketUserId);
            }

            const closedEmbed = new EmbedBuilder()
                .setTitle('Ticket Closed')
                .setDescription(`Ticket Closed by <@${interaction.user.id}>`)
                .setColor(0xff0000)
                .setTimestamp();

            const controlsEmbed = new EmbedBuilder()
                .setTitle('Support team ticket controls')
                .setColor(this.client.color);

            const controlButtons = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_open')
                        .setLabel('Open')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('ticket_delete')
                        .setLabel('Delete')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.editReply({ content: 'Ticket has been closed successfully.' });

            await channel.send({ embeds: [closedEmbed] });
            await channel.send({ embeds: [controlsEmbed], components: [controlButtons] });

            this.client.logger.log({
                message: `Ticket ${channel.name} closed by ${interaction.user.username} (${interaction.user.id})`,
                handler: this.constructor.name
            }, true);

        } catch (error) {
            this.client.logger.error({
                message: 'Failed to close ticket',
                error,
                handler: this.constructor.name
            });

            await interaction.editReply({ content: 'An error occurred while closing the ticket. Please try again.' });
        }
    }

    private async handleTicketCloseCancel(interaction: ButtonInteraction<'cached'>): Promise<void> {
        await interaction.update({ content: 'Ticket closure cancelled.', embeds: [], components: [] });
    }

    private async canCloseTicket(interaction: ButtonInteraction<'cached'>): Promise<boolean> {
        const hasRolePermissions = await this.client.util.hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        if (hasRolePermissions) return true;

        const channel = interaction.channel as TextChannel;
        const userPermissions = channel.permissionOverwrites.cache.get(interaction.user.id);

        return userPermissions !== undefined;
    }

    //#endregion

    //#region SUPPORT TEAM CONTROLS
    private async logTicketToForum(channel: TextChannel, user: any, logReason: string): Promise<string | null> {
        const messages = await UtilityHandler.readAllMessages(channel);
        const messageArray = Array.from(messages.values());

        const transcriptBuffer = await TranscriptGenerator.createTranscript(messages, channel.name);
        const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, { name: `${channel.name}-transcript.html` });

        const welcomeMessage = messages.find(msg =>
            msg.content.includes('your ticket has been created') &&
            msg.content.match(/<@(\d+)>,/)
        );

        let ticketOpener = 'Unknown';
        let ticketType = 'unknown';

        if (welcomeMessage) {
            const userIdMatch = welcomeMessage.content.match(/<@(\d+)>,/);
            if (userIdMatch) {
                const userId = userIdMatch[1];
                try {
                    const guildUser = await channel.guild.members.fetch(userId);
                    ticketOpener = guildUser.user.username;
                } catch {
                    ticketOpener = `User ID: ${userId}`;
                }
            }
        }

        const channelNameParts = channel.name.split('-');
        if (channelNameParts.length > 0) {
            ticketType = channelNameParts[0];
        }

        const ticketEmbedMessage = messages.find(msg =>
            msg.author.id === this.client.user?.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title?.includes('Ticket') &&
            !msg.embeds[0].title?.includes('Closed') &&
            msg.embeds[0].fields && msg.embeds[0].fields.length > 0
        );
        const originalTicketEmbed = ticketEmbedMessage?.embeds[0];

        let forumTitle = `${ticketType}-${ticketOpener}`;

        if (ticketType === 'report' && originalTicketEmbed?.fields) {
            const reportedUserField = originalTicketEmbed.fields.find(field =>
                field.name === 'Reported User'
            );

            if (reportedUserField) {
                const reportedUser = reportedUserField.value.replace(/```/g, '').trim();
                forumTitle = `Report-${ticketOpener}-${reportedUser}`;
            }
        } else if (ticketType === 'clearance' && originalTicketEmbed?.fields) {
            const reportedUserField = originalTicketEmbed.fields.find(field =>
                field.name === 'RSN' || 'Reported User'
            );

            if (reportedUserField) {
                const reportedUser = reportedUserField.value.replace(/```/g, '').trim();
                forumTitle = `Clearance-${reportedUser}`;
            }
        }

        const summaryEmbed = new EmbedBuilder()
            .setTitle(`Ticket Log: ${channel.name}`)
            .setColor(0x99ccff)
            .addFields(
                { name: 'Ticket Opener', value: ticketOpener, inline: false },
                { name: 'Ticket Type', value: ticketType, inline: false },
                { name: 'Log Generated By', value: `${user.username} (${user.id})`, inline: false },
                { name: 'Log Reason', value: logReason, inline: false },
                { name: 'Generated At', value: new Date().toISOString(), inline: false },
                { name: 'Channel', value: channel.name, inline: false },
                { name: 'Message Count', value: messageArray.length.toString(), inline: false }
            );

        const forumChannel = await channel.guild.channels.fetch(this.client.channelIds.TICKET_TRANSCRIPT_CHANNEL);
        if (!forumChannel || !forumChannel.isThreadOnly()) {
            throw new Error('Could not find or access the forum channel.');
        }

        const tagName = ticketType === 'contentcreator' ? 'Content Creator' : ticketType === 'clearance' ? 'report' :
                       ticketType.charAt(0).toUpperCase() + ticketType.slice(1);

        const availableTags = forumChannel.availableTags;
        const matchingTag = availableTags.find(tag =>
            tag.name.toLowerCase() === tagName.toLowerCase() ||
            (ticketType === 'contentcreator' && tag.name.toLowerCase() === 'content creator') ||
            (ticketType === 'report' && tag.name.toLowerCase() === 'reports')
        );

        try {
            const forumPost = await forumChannel.threads.create({
                name: forumTitle,
                message: {
                    embeds: originalTicketEmbed ? [summaryEmbed, originalTicketEmbed] : [summaryEmbed],
                    files: [transcriptAttachment]
                },
                appliedTags: matchingTag ? [matchingTag.id] : []
            });

            let currentBlock = '';
            const maxLength = 1900;

            let currentDate = '';

            for (const message of messageArray) {
                if (message.author.id === this.client.user?.id) {
                    continue;
                }

                const messageDate = message.createdAt.toLocaleDateString();
                const timeOnly = message.createdAt.toLocaleTimeString();
                const author = message.author.username;
                const content = (message.content || '')
                    .replace(/<@!?(\d+)>/g, '@$1')
                    .replace(/<@&(\d+)>/g, '@&$1');

                if (currentDate !== messageDate) {
                    currentDate = messageDate;
                    const dateHeader = `\n**--- ${messageDate} ---**\n`;

                    if (currentBlock.length + dateHeader.length > maxLength) {
                        // BANDAID
                        for (let i = 0; i < currentBlock.length; i += 2000) {
                            await forumPost.send({ content: currentBlock.slice(i, i + 2000) });
                        }

                        currentBlock = dateHeader;
                    } else {
                        currentBlock += dateHeader;
                    }
                }

                const messageBlock = `**[${timeOnly}] ${author}:** ${content || '*No text content*'}\n`;

                const hasAttachments = message.attachments.size > 0;

                if (currentBlock.length + messageBlock.length > maxLength && currentBlock.length > 0) {
                    // BANDAID
                    for (let i = 0; i < currentBlock.length; i += 2000) {
                        await forumPost.send({ content: currentBlock.slice(i, i + 2000) });
                    }
                    currentBlock = '';
                }

                currentBlock += messageBlock;

                if (hasAttachments) {
                    for (const attachment of message.attachments.values()) {
                        const attachmentBlock = `**[${timeOnly}] ${author}:** ${attachment.url}\n`;

                        if (currentBlock.length + attachmentBlock.length > maxLength) {
                            // BANDAID
                            for (let i = 0; i < currentBlock.length; i += 2000) {
                                await forumPost.send({ content: currentBlock.slice(i, i + 2000) });
                            }
                            currentBlock = attachmentBlock;
                        } else {
                            currentBlock += attachmentBlock;
                        }
                    }
                }

                if (message.embeds.length > 0) {
                    const embedInfo = `*[${author} sent ${message.embeds.length} embed(s)]*\n`;

                    if (currentBlock.length + embedInfo.length > maxLength) {
                        // BANDAID
                        for (let i = 0; i < currentBlock.length; i += 2000) {
                            await forumPost.send({ content: currentBlock.slice(i, i + 2000) });
                        }
                        currentBlock = embedInfo;
                    } else {
                        currentBlock += embedInfo;
                    }
                }
            }

            if (currentBlock.trim()) {
                // BANDAID
                for (let i = 0; i < currentBlock.length; i += 2000) {
                    await forumPost.send({ content: currentBlock.slice(i, i + 2000) });
                }
            }

            // close and lock forum to not randomly reach discords limit for open forum threads (1000)
            await forumPost.setLocked(true);
            await forumPost.setArchived(true);

            return forumPost.id;
        } catch(error) {
            this.client.logger.error({
                message: `Failed to create forum post for transcript log for channel ${channel.name}`,
                error,
                handler: this.constructor.name
            });
            return null;
        }
    }

    private async handleTicketOpen(interaction: ButtonInteraction<'cached'>): Promise<void> {
        // Check if user has admin/owner permissions
        const hasPermission = await this.client.util.hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        if (!hasPermission) {
            await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const channel = interaction.channel as TextChannel;

            // Find the ticket opener using multiple methods (same as close functionality)
            let ticketUserId: string | null = null;

            // Method 1: Look for welcome message
            const messages = await UtilityHandler.readAllMessages(channel);
            const welcomeMessage = messages.find(msg =>
                msg.content && (
                    msg.content.includes('your ticket has been created') ||
                    msg.content.includes('ticket has been created')
                ) && msg.content.match(/<@(\d+)>/)
            );

            if (welcomeMessage) {
                const userIdMatch = welcomeMessage.content.match(/<@(\d+)>/);
                if (userIdMatch) {
                    ticketUserId = userIdMatch[1];
                }
            }

            // Method 2: Look for closed ticket message (since this is reopening)
            if (!ticketUserId) {
                const closedMessage = messages.find(msg =>
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title === 'Ticket Closed' &&
                    msg.embeds[0].description?.match(/Ticket Closed by <@(\d+)>/)
                );

                if (closedMessage) {
                    // We know the ticket was closed, but we need the original opener
                    // Let's try to find any message that mentions a user
                    const anyUserMention = messages.find(msg =>
                        msg.content && msg.content.match(/<@(\d+)>/) &&
                        !msg.content.includes('Ticket Closed by')
                    );

                    if (anyUserMention) {
                        const userIdMatch = anyUserMention.content.match(/<@(\d+)>/);
                        if (userIdMatch) {
                            ticketUserId = userIdMatch[1];
                        }
                    }
                }
            }

            // Method 3: Extract from channel name or ask admin
            if (!ticketUserId) {
                await interaction.editReply({
                    content: 'Could not identify the original ticket opener. Please manually add the user back to this channel, or contact an administrator.'
                });
                return;
            }

            // Re-add user's permissions to the channel
            await channel.permissionOverwrites.create(ticketUserId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            // Find and delete the support team controls message
            const controlsMessage = messages.find(msg =>
                msg.embeds.length > 0 &&
                msg.embeds[0].title === 'Support team ticket controls'
            );

            if (controlsMessage) {
                try {
                    await controlsMessage.delete();
                } catch (error) {
                    this.client.logger.error({
                        message: 'Failed to delete support team controls message',
                        error,
                        handler: this.constructor.name
                    });
                }
            }

            // Send reopened message
            const reopenEmbed = new EmbedBuilder()
                .setTitle('Ticket Reopened')
                .setDescription(`This ticket has been reopened by <@${interaction.user.id}>.`)
                .setColor(0x00ff00)
                .setTimestamp();

            await channel.send({ embeds: [reopenEmbed] });

            await interaction.editReply({ content: 'Ticket has been reopened successfully.' });

            this.client.logger.log({
                message: `Ticket ${channel.name} reopened by ${interaction.user.username} (${interaction.user.id})`,
                handler: this.constructor.name
            }, true);

        } catch (error) {
            this.client.logger.error({
                message: 'Failed to reopen ticket',
                error,
                handler: this.constructor.name
            });

            await interaction.editReply({ content: 'An error occurred while reopening the ticket. Please try again.' });
        }
    }

    private async handleTicketDelete(interaction: ButtonInteraction<'cached'>): Promise<void> {
        // Check if user has admin/owner permissions
        const hasPermission = await this.client.util.hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        if (!hasPermission) {
            await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const channel = interaction.channel as TextChannel;

            // First, log the ticket to the forum, which now also attaches the transcript
            await interaction.editReply({ content: 'Archiving ticket to forum...' });
            const forumPostId = await this.logTicketToForum(channel, interaction.user, 'Automatically logged before deletion');

            if (!forumPostId) {
                await interaction.editReply({ content: 'Error: Failed to archive ticket to the forum. Aborting deletion.' });
                return;
            }

            // if warnings for that ticket existed, update them to the archive
            await this.updateReportrefs(channel.id, forumPostId);

            // New: Attempt to find the ticket opener and send them a DM with a download button
            const ticketOpenerId = await TicketHandler.findTicketOpener(channel, this.client);
            this.client.logger.log({
                message: `[Transcript] Found ticket opener ID: ${ticketOpenerId} for channel ${channel.name}`,
                handler: this.constructor.name
            }, true);

            if (ticketOpenerId) {
                try {
                    const ticketOpener = await this.client.users.fetch(ticketOpenerId);
                    this.client.logger.log({
                        message: `[Transcript] Fetched user ${ticketOpener.username} (${ticketOpener.id})`,
                        handler: this.constructor.name
                    }, true);

                    const dmEmbed = new EmbedBuilder()
                        .setTitle('Ticket Closed')
                        .setDescription(`Your ticket **#${channel.name}** has been closed and archived. You can download a copy of the transcript at any time.`)
                        .setColor(this.client.color)
                        .setTimestamp();

                    const buttonId = `ticket:download_transcript_${forumPostId}`;
                    const downloadButton = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(buttonId)
                                .setLabel('Download Transcript')
                                .setStyle(ButtonStyle.Primary)
                        );

                    this.client.logger.log({
                        message: `[Transcript] Sending DM to ${ticketOpener.username} with button ID: "${buttonId}"`,
                        handler: this.constructor.name
                    }, true);

                    await ticketOpener.send({
                        embeds: [dmEmbed],
                        components: [downloadButton]
                    });

                    this.client.logger.log({
                        message: `[Transcript] Successfully sent DM to ${ticketOpener.username}`,
                        handler: this.constructor.name
                    }, true);

                } catch (dmError: any) {
                    this.client.logger.error({
                        message: `Failed to DM transcript button to user ${ticketOpenerId}`,
                        error: { message: dmError.message, stack: dmError.stack, name: dmError.name },
                        handler: this.constructor.name
                    });
                    await interaction.followUp({ content: 'Could not send DM to the user. They may have DMs disabled.', flags: MessageFlags.Ephemeral });
                }
            } else {
                await interaction.followUp({ content: 'Warning: Could not identify the ticket opener to send a DM.', flags: MessageFlags.Ephemeral });
            }

            this.client.logger.log({
                message: `Ticket ${channel.name} deleted by ${interaction.user.username} (${interaction.user.id})`,
                handler: this.constructor.name
            }, true);

            await interaction.followUp({ content: 'Ticket archived. This channel will be deleted in 5 seconds...' });

            // Delete the channel after a short delay
            setTimeout(async () => {
                try {
                    await channel.delete('Ticket deleted by admin/owner');
                    await this.saveTicketClose(channel.id, interaction.user.id, forumPostId);
                } catch (error) {
                    this.client.logger.error({
                        message: 'Failed to delete ticket channel',
                        error,
                        handler: this.constructor.name
                    });
                }
            }, 5000);

        } catch (error) {
            this.client.logger.error({
                message: 'Failed to delete ticket',
                error,
                handler: this.constructor.name
            });

            await interaction.editReply({ content: 'An error occurred while deleting the ticket. Please try again.' });
        }
    }

    //#endregion

    //#region TRANSCRIPT SYSTEM
    public static async findTicketOpener(channel: TextChannel, client: Bot): Promise<string | null> {
        const messages = await UtilityHandler.readAllMessages(channel);
        const welcomeMessage = messages.find(msg =>
            msg.author.id === client.user?.id &&
            msg.content &&
            msg.content.includes('ticket has been created') &&
            msg.mentions.users.first()
        );

        if (welcomeMessage && welcomeMessage.mentions.users.first()) {
            return welcomeMessage.mentions.users.first()!.id;
        }

        for (const [id, overwrite] of channel.permissionOverwrites.cache) {
            if (overwrite.type === 1 && overwrite.allow.has('ViewChannel')) {
                const isAdmin = id === client.roleIds.admin;
                const isOwner = id === client.roleIds.owner;
                const isBot = id === client.user?.id;

                if (!isAdmin && !isOwner && !isBot) {
                    return id;
                }
            }
        }

        return null;
    }

    public static async handleDMTranscriptDownload(client: Bot, interaction: ButtonInteraction, forumPostId: string): Promise<void> {
        client.logger.log({
            message: `[Transcript] handleDMTranscriptDownload called with forumPostId: "${forumPostId}", user: ${interaction.user.id}`,
            handler: 'ButtonHandler'
        }, true);

        try {
            await interaction.deferReply({ ephemeral: true });
            client.logger.log({
                message: `[Transcript] Successfully deferred reply for post ${forumPostId}`,
                handler: 'ButtonHandler'
            }, true);
        } catch (error: any) {
            client.logger.error({
                message: `[Transcript] FAILED to defer reply for post ${forumPostId}`,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                handler: 'ButtonHandler'
            });
            return;
        }

        client.logger.log({ message: `[Transcript] Received download request for post ${forumPostId}.`, handler: 'ButtonHandler' }, true);

        try {
            client.logger.log({ message: `[Transcript] Fetching forum channel ${client.channelIds.TICKET_TRANSCRIPT_CHANNEL}...`, handler: 'ButtonHandler' }, true);
            const forumChannel = await client.channels.fetch(client.channelIds.TICKET_TRANSCRIPT_CHANNEL);
            if (!forumChannel || !forumChannel.isThreadOnly()) {
                await interaction.editReply({ content: 'Error: Could not find the transcript archive.' });
                return;
            }
            client.logger.log({ message: `[Transcript] Forum channel found. Fetching thread ${forumPostId}...`, handler: 'ButtonHandler' }, true);

            const thread = await forumChannel.threads.fetch(forumPostId);
            if (!thread) {
                await interaction.editReply({ content: 'Error: Could not find the specific transcript for this ticket.' });
                return;
            }
            client.logger.log({ message: `[Transcript] Thread found. Fetching starter message...`, handler: 'ButtonHandler' }, true);

            const starterMessage = await thread.fetchStarterMessage();
            if (!starterMessage || starterMessage.attachments.size === 0) {
                await interaction.editReply({ content: 'Error: The archived transcript is missing its attachment.' });
                return;
            }
            client.logger.log({ message: `[Transcript] Starter message found. Getting attachment...`, handler: 'ButtonHandler' }, true);

            const transcriptAttachment = starterMessage.attachments.first();
            if (!transcriptAttachment) {
                await interaction.editReply({ content: 'Error: Could not retrieve the transcript attachment.' });
                return;
            }
            client.logger.log({ message: `[Transcript] Attachment found: ${transcriptAttachment.name}. URL: ${transcriptAttachment.url}`, handler: 'ButtonHandler' }, true);

            client.logger.log({ message: `[Transcript] Sending direct link to user...`, handler: 'ButtonHandler' }, true);
            await interaction.editReply({
                content: `Here is your transcript - click the link below to view it in your browser:\n\n**[📄 View Transcript](${transcriptAttachment.url})**\n\n*This link will open the transcript in a new browser tab.*`
            });
            client.logger.log({ message: `[Transcript] Direct link sent successfully for post ${forumPostId}.`, handler: 'ButtonHandler' }, true);

        } catch (error: any) {
            client.logger.error({
                message: `[Transcript] CRITICAL FAILURE while retrieving transcript for forum post ${forumPostId}`,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    isAxiosError: error.isAxiosError,
                    axiosRequest: error.config?.url,
                    axiosResponseStatus: error.response?.status,
                    axiosResponseData: error.response?.data?.toString(),
                },
                handler: 'ButtonHandler'
            });

            // Final attempt to notify the user
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An unexpected error occurred while fetching your transcript. Please report this.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.editReply({ content: 'An unexpected error occurred while fetching your transcript. Please report this.' }).catch(() => {});
            }
        }
    }

    private async handleTranscriptDownload(interaction: ButtonInteraction, forumPostId: string): Promise<void> {
        this.client.logger.log({
            message: `[Transcript] handleTranscriptDownload called with forumPostId: "${forumPostId}", user: ${interaction.user.id}`,
            handler: this.constructor.name
        }, true);

        try {
            await interaction.deferReply({ ephemeral: true });
            this.client.logger.log({
                message: `[Transcript] Successfully deferred reply for post ${forumPostId}`,
                handler: this.constructor.name
            }, true);
        } catch (error: any) {
            this.client.logger.error({
                message: `[Transcript] FAILED to defer reply for post ${forumPostId}`,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                handler: this.constructor.name
            });
            return;
        }

        this.client.logger.log({ message: `[Transcript] Received download request for post ${forumPostId}.`, handler: this.constructor.name }, true);

        try {
            this.client.logger.log({ message: `[Transcript] Fetching forum channel ${this.client.channelIds.TICKET_TRANSCRIPT_CHANNEL}...`, handler: this.constructor.name }, true);
            const forumChannel = await this.client.channels.fetch(this.client.channelIds.TICKET_TRANSCRIPT_CHANNEL);
            if (!forumChannel || !forumChannel.isThreadOnly()) {
                await interaction.editReply({ content: 'Error: Could not find the transcript archive.' });
                return;
            }
            this.client.logger.log({ message: `[Transcript] Forum channel found. Fetching thread ${forumPostId}...`, handler: this.constructor.name }, true);

            const thread = await forumChannel.threads.fetch(forumPostId);
            if (!thread) {
                await interaction.editReply({ content: 'Error: Could not find the specific transcript for this ticket.' });
                return;
            }
            this.client.logger.log({ message: `[Transcript] Thread found. Fetching starter message...`, handler: this.constructor.name }, true);

            const starterMessage = await thread.fetchStarterMessage();
            if (!starterMessage || starterMessage.attachments.size === 0) {
                await interaction.editReply({ content: 'Error: The archived transcript is missing its attachment.' });
                return;
            }
            this.client.logger.log({ message: `[Transcript] Starter message found. Getting attachment...`, handler: this.constructor.name }, true);

            const transcriptAttachment = starterMessage.attachments.first();
            if (!transcriptAttachment) {
                await interaction.editReply({ content: 'Error: Could not retrieve the transcript attachment.' });
                return;
            }
            this.client.logger.log({ message: `[Transcript] Attachment found: ${transcriptAttachment.name}. URL: ${transcriptAttachment.url}`, handler: this.constructor.name }, true);

            this.client.logger.log({ message: `[Transcript] Downloading file via axios...`, handler: this.constructor.name }, true);
            const response = await axios.get(transcriptAttachment.url, {
                responseType: 'arraybuffer'
            });
            this.client.logger.log({ message: `[Transcript] File downloaded successfully. Status: ${response.status}.`, handler: this.constructor.name }, true);

            const newAttachment = new AttachmentBuilder(response.data, { name: transcriptAttachment.name });

            this.client.logger.log({ message: `[Transcript] Replying to interaction with file...`, handler: this.constructor.name }, true);
            await interaction.editReply({
                content: 'Here is your transcript:',
                files: [newAttachment]
            });
            this.client.logger.log({ message: `[Transcript] Interaction reply sent successfully for post ${forumPostId}.`, handler: this.constructor.name }, true);

        } catch (error: any) {
            this.client.logger.error({
                message: `[Transcript] CRITICAL FAILURE while retrieving transcript for forum post ${forumPostId}`,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    isAxiosError: error.isAxiosError,
                    axiosRequest: error.config?.url,
                    axiosResponseStatus: error.response?.status,
                    axiosResponseData: error.response?.data?.toString(),
                },
                handler: this.constructor.name
            });

            // Final attempt to notify the user
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An unexpected error occurred while fetching your transcript. Please report this.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.editReply({ content: 'An unexpected error occurred while fetching your transcript. Please report this.' }).catch(() => {});
            }
        }
    }

    //#endregion

    //#region Utilities
    public async getNextTicketNumber(ticketType: string): Promise<number> {
        const ticketNumbersPath = path.join(process.cwd(), 'ticket-numbers.json');

        try {
            const data = await fs.readFile(ticketNumbersPath, 'utf-8');
            const ticketNumbers = JSON.parse(data);

            // Increment the number for this ticket type
            ticketNumbers[ticketType] = (ticketNumbers[ticketType] || 0) + 1;

            // Save back to file
            await fs.writeFile(ticketNumbersPath, JSON.stringify(ticketNumbers, null, 4));

            return ticketNumbers[ticketType];
        } catch (error) {
            this.client.logger.error({
                message: 'Failed to read/write ticket numbers file',
                error,
                handler: 'UtilityHandler'
            });

            // Fallback to 1 if file doesn't exist or is corrupted
            return 1;
        }
    }

    public async createTicketChannel(guild: any, ticketType: string, userId: string, ticketNumber: number): Promise<TextChannel | null> {
        try {
            const channelName = `${ticketType}-${ticketNumber.toString().padStart(4, '0')}`;
            const isStaffTicket = ticketType === 'librarian' || ticketType === 'support' || ticketType === 'teacher' || ticketType === 'trialteam';
            const parentCategoryId = ticketType === 'learner' ? this.client.channelIds.learnerTicketsCategory : isStaffTicket ? this.client.channelIds.staffTicketsCategory : this.client.channelIds.ticketCategory;

            // Get admin and owner role IDs
            const adminRoleId = this.client.roleIds.admin;
            const ownerRoleId = this.client.roleIds.owner;
            const teacherRoleId = this.client.roleIds.teacher;

            // Create the channel with proper permissions
            const channel: TextChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: parentCategoryId,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    {
                        id: adminRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ManageChannels
                        ]
                    },
                    {
                        id: ownerRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });

            if (ticketType === 'learner') {
                await channel.permissionOverwrites.create(
                    teacherRoleId,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        AttachFiles: true,
                        EmbedLinks: true,
                        ManageMessages: true,
                        ManageChannels: true,
                    }
                );
            }

            if (isStaffTicket) {
                const adminRole = this.client.roles.admin;
                const ownerRole = this.client.roles.owner;

                const member = await guild.members.fetch(userId);
                const thread = await channel.threads.create({
                    name: `Discussion - ${member.displayName}`,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                    type: ChannelType.PrivateThread,
                    reason: 'Thread automatically created by TicketHandler'
                });

                await thread.send(`${adminRole}, ${ownerRole}: Discuss the applicant here`);
            }

            this.client.logger.log({
                message: `Created ticket channel: ${channelName} for user ${userId}`,
                handler: 'UtilityHandler'
            }, true);

            return channel;
        } catch (error) {
            this.client.logger.error({
                message: `Failed to create ticket channel for type: ${ticketType}`,
                error,
                handler: 'UtilityHandler'
            });
            return null;
        }
    }

    public async sendTicketWelcomeMessage(channel: TextChannel, userId: string, ticketType: string, formData: any): Promise<void> {
        try {
            const { capitalizeFirstLetter } = this.client.util
            const adminRole = this.client.roles.admin;
            const ownerRole = this.client.roles.owner;
            const teacherRole = this.client.roles.teacher;
            const isStaffTicket = ticketType === 'librarian' || ticketType === 'support' || ticketType === 'teacher' || ticketType === 'trialteam';

            // Create welcome message
            let welcomeMessage = `<@${userId}>, your ticket has been created. An ${isStaffTicket ? 'Admin' : adminRole} or ${isStaffTicket ? 'Owner' : ownerRole} will be with you shortly.`;

            if (ticketType === 'learner') {
                welcomeMessage = `<@${userId}>, your ticket has been created. A ${teacherRole} will be with you shortly.`;
            }


            if (ticketType === 'clearance') {
                welcomeMessage = 'Your clearance ticket has been created.';
            }

            // Create embed with form data using fields for better organization
            const embed = new EmbedBuilder()
                .setTitle(`${ticketType === 'trialteam' ? 'Trial Team' : capitalizeFirstLetter(ticketType)} Ticket`)
                .setColor(this.client.color)
                .setTimestamp()
                .setAuthor({
                    name: `User: ${channel.guild.members.cache.get(userId)?.user.username || 'Unknown User'}`,
                    iconURL: channel.guild.members.cache.get(userId)?.user.displayAvatarURL() || undefined
                });

            let urls: string[] = [];
            const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

            // Format the form data based on ticket type using fields
            switch (ticketType) {
                case 'suggestion':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Suggestion', value: `\`\`\`${formData.suggestion}\`\`\``, inline: false },
                        { name: 'Why would this work?', value: `\`\`\`${formData.reason}\`\`\``, inline: false }
                    );

                    urls = urls.concat(formData.suggestion.match(urlRegex) || []);
                    urls = urls.concat(formData.reason.match(urlRegex) || []);
                    break;
                case 'report':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Reported User', value: `\`\`\`${formData.reported_user}\`\`\``, inline: false },
                        { name: 'Reason', value: `\`\`\`${formData.reason}\`\`\``, inline: false },
                        { name: 'Description', value: `\`\`\`${formData.description}\`\`\``, inline: false }
                    );

                    urls = urls.concat(formData.reason.match(urlRegex) || []);
                    urls = urls.concat(formData.description.match(urlRegex) || []);
                    break;
                case 'contentcreator':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Platform URL', value: `\`\`\`${formData.platform_url}\`\`\``, inline: false },
                        { name: 'Additional Information', value: `\`\`\`${formData.additional}\`\`\``, inline: false }
                    );

                    urls = urls.concat(formData.platform_url.match(urlRegex) || []);
                    urls = urls.concat(formData.additional.match(urlRegex) || []);
                    break;
                case 'other':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'How can we assist?', value: `\`\`\`${formData.assistance}\`\`\``, inline: false }
                    );

                    urls = urls.concat(formData.assistance.match(urlRegex) || []);
                    break;
                case 'clearance':
                    embed.addFields(
                        { name: 'RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Discord ID', value: `\`\`\`${formData.discordid}\`\`\``, inline: false },
                        { name: 'Description', value: `\`\`\`${formData.description}\`\`\``, inline: false }
                    );

                    urls = urls.concat(formData.description.match(urlRegex) || []);
                    break;
                case 'learner':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Timezone and Game Times Active', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Confirm you\'ve read & understand requirements', value: `\`\`\`${formData.confirm}\`\`\``, inline: false },
                        { name: 'What are you hoping to get out of this ticket?', value: `\`\`\`${formData.goals}\`\`\``, inline: false },
                        { name: 'Provide secret word', value: `\`\`\`${formData.secretWord}\`\`\``, inline: false }
                    );
                    urls = urls.concat(formData.goals.match(urlRegex) || []);
                    break;
                case 'librarian':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Timezone and Game Times active', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Why are you applying for this role?', value: `\`\`\`${formData.reasons}\`\`\``, inline: false }
                    );
                    urls = urls.concat(formData.reasons.match(urlRegex) || []);
                    break;
                case 'support':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Timezone and Game Times active', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Why are you applying for this role?', value: `\`\`\`${formData.reasons}\`\`\``, inline: false }
                    );
                    urls = urls.concat(formData.reasons.match(urlRegex) || []);
                    break;
                case 'teacher':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Timezone and Game Times active', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Which enrage do you want to teach people', value: `\`\`\`${formData.enrage}\`\`\``, inline: false },
                        { name: 'Please provide your preset and kc', value: `\`\`\`${formData.presetkc}\`\`\``, inline: false },
                        { name: 'Why are you applying for this role?', value: `\`\`\`${formData.reasons}\`\`\``, inline: false }
                    );
                    urls = urls.concat(formData.reasons.match(urlRegex) || []);
                    break;
                case 'trialteam':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Timezone and Game Times active', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Which enrage do you want to trial people', value: `\`\`\`${formData.enrage}\`\`\``, inline: false },
                        { name: 'Please provide your preset and kc', value: `\`\`\`${formData.presetkc}\`\`\``, inline: false },
                        { name: 'Why are you applying for this role?', value: `\`\`\`${formData.reasons}\`\`\``, inline: false }
                    );
                    urls = urls.concat(formData.reasons.match(urlRegex) || []);
                    break;
            }

            // Create close button
            const closeButton = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Secondary)
                );

            await channel.send({ content: welcomeMessage, embeds: [embed], components: [closeButton] });

            if (ticketType === 'report') {
                await channel.send('## To help us assist you faster, please provide any supporting evidence such as screenshots, recordings, or messages.');
            }

            if (ticketType === 'learner') {
                const container = this.client.cv2.getContainerBuilder(null, '## Additional information required');
                container.addTextDisplayComponents(builder => builder.setContent([
                    '- Your overall PvM experience',
                    '- A screenshot of your Amascut preset to provide feedback',
                    '- A screenshot of your kill count and current PR (please include your RSN in screenshot)',
                    '- Please change your discord nickname to your RSN if you haven\'t already'
                ].join('\n')));

                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
                container.addTextDisplayComponents(builder => builder.setContent('### Teacher Controls'));
                container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                    [
                        new ButtonBuilder()
                            .setCustomId('host_learner_post_nm')
                            .setLabel('Host Normal Mode')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                ));
                container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                    [
                        new ButtonBuilder()
                            .setCustomId('host_learner_post_100')
                            .setLabel('Host 100%')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('host_learner_post_500')
                            .setLabel('Host 500%')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('host_learner_post_750')
                            .setLabel('Host 750%')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('host_learner_post_1000')
                            .setLabel('Host 1000%')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('host_learner_post_2000')
                            .setLabel('Host 2000%')
                            .setStyle(ButtonStyle.Secondary),
                    ]
                ));

                await channel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { 'parse': [] }
                });
            }

            if (urls.length > 0) {
                await channel.send(`Found following URL's:\n${urls.join('\n\n')}`);
            }

            this.client.logger.log({
                message: `Sent welcome message to ticket channel: ${channel.name}`,
                handler: 'UtilityHandler'
            }, true);
        } catch (error) {
            this.client.logger.error({
                message: `Failed to send welcome message to ticket channel: ${channel.name}`,
                error,
                handler: 'UtilityHandler'
            });
        }
    }
    //#endregion

    //#region Database

    private async saveTicketSubmit(userOpen: string, channelId: string, ticketType: string): Promise<void> {
        const { dataSource } = this.client;
        const ticketRepository = dataSource.getRepository(Ticket);
        const ticketObject = new Ticket();

        ticketObject.channelId = channelId;
        ticketObject.userOpen = userOpen;

        // 0 = Suggestion, 1 = Report, 2 = Content Creator, 3 = Other
        switch (ticketType) {
            case 'report':
                ticketObject.ticketType = 1;
                break;
            case 'suggestion':
                ticketObject.ticketType = 0;
                break;
            case 'contentcreator':
                ticketObject.ticketType = 2;
                break;
            case 'other':
                ticketObject.ticketType = 3;
                break;
            case 'clearance':
                ticketObject.ticketType = 4;
                break;
            case 'learner':
                ticketObject.ticketType = 5;
            case 'librarian':
                ticketObject.ticketType = 6;
            case 'support':
                ticketObject.ticketType = 7;
            case 'teacher':
                ticketObject.ticketType = 8;
            case 'trialteam':
                ticketObject.ticketType = 9;
        }

        await ticketRepository.save(ticketObject);
    }

    private async saveTicketClose(channelId: string, userClose: string, forumPostId: string): Promise<void> {
        const { dataSource } = this.client;
        const ticketRepository = dataSource.getRepository(Ticket);

        const existingEntry = await ticketRepository.findOne({
            where: {
                channelId: channelId
            }
        });

        if (existingEntry) {
            existingEntry.userClose = userClose;
            existingEntry.forumPostId = forumPostId;
            await ticketRepository.save(existingEntry);
        } else {
            this.client.logger.log({ message: `[Ticket System] Ticket with Channel-Id ${channelId} could not be found.`, handler: this.constructor.name }, true);
        }
    }

    private async updateReportrefs(channelId: string, forumPostId: string): Promise<void> {
        const { dataSource } = this.client;
        const warningRepository = dataSource.getRepository(Warning);

        const existingEntries = await warningRepository.find({
            where: {
                reportRef: channelId
            }
        });

        for (const warning of existingEntries) {
            warning.reportRef = forumPostId;
        }

        await warningRepository.save(existingEntries);
    }

    //#endregion
}
