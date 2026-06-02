import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, FileUploadBuilder, GuildMember, Interaction, Message, MessageFlags, ModalBuilder, ModalSubmitInteraction, OverwriteType, PermissionFlagsBits, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, TextInputBuilder, TextInputStyle, ThreadAutoArchiveDuration, User, UserContextMenuCommandInteraction, UserSelectMenuBuilder } from 'discord.js';
import Bot from '../Bot';
import axios from 'axios';
import TranscriptGenerator from './TranscriptGenerator';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Ticket } from '../entity/Ticket';
import { Vouch } from '../entity/Vouch';
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

        if (interaction.isContextMenuCommand()) {
            switch (interaction.commandName) {
                case 'create clearance ticket': this.handleContextCreateClearanceTicket(interaction as UserContextMenuCommandInteraction); break;
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
            case 'ticket:create_lorebook': this.handleTicketLoreBook(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_lorebookkill': this.handleTicketLoreBookKill(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_support': this.handleTicketSupport(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_teacher': this.handleTicketTeacher(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_trialteam': this.handleTicketTrialTeam(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_trialee': this.handleTicketTrialee(interaction as ButtonInteraction<'cached'>); break;
            case 'ticket:create_trialreport': this.handleTicketTrialReport(interaction as ButtonInteraction<'cached'>); break;
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

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Suggestion
        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestion')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('Briefly describe your suggestion')
            .setTextInputComponent(suggestionInput)
        );

        // Reason
        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('Why do you think your suggestion would work?')
            .setTextInputComponent(reasonInput)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketReport(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_report_${interaction.user.id}`)
            .setTitle('Submit a Report');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Reported user
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('user_select')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label
            .setLabel('Who are you reporting?')
            .setUserSelectMenuComponent(userSelect)
        );

        const reportedUserInput = new TextInputBuilder()
            .setCustomId('reported_user')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        modal.addLabelComponents(label => label
            .setLabel('RSN of the user, you are reporting')
            .setTextInputComponent(reportedUserInput)
        );

        // Reason
        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('What is the reason for your report?')
            .setTextInputComponent(reasonInput)
        );

        // Evidence
        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(false);

        modal.addLabelComponents(label => label
            .setLabel('Please provide any evidence you got')
            .setFileUploadComponent(fileUpload)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketTrialReport(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_trialreport_${interaction.user.id}`)
            .setTitle('Submit a Trial Report');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Reported user
        const userReport = new UserSelectMenuBuilder()
            .setCustomId('user_report')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label
            .setLabel('Who are you reporting?')
            .setUserSelectMenuComponent(userReport)
        );

        const reportedUserInput = new TextInputBuilder()
            .setCustomId('reported_user')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        modal.addLabelComponents(label => label
            .setLabel('What is the RSN of the person')
            .setTextInputComponent(reportedUserInput)
        );

        // Reason
        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('What is the reason for your report?')
            .setTextInputComponent(reasonInput)
        );

        // Evidence
        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(false);

        modal.addLabelComponents(label => label
            .setLabel('Please provide any evidence you have')
            .setFileUploadComponent(fileUpload)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketContentCreator(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_contentcreator_${interaction.user.id}`)
            .setTitle('Content Creator Application');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        const platformInput = new TextInputBuilder()
            .setCustomId('platform_url')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200);

        modal.addLabelComponents(label => label
            .setLabel('What\'s your streaming platform URL?')
            .setTextInputComponent(platformInput)
        );

        const additionalInput = new TextInputBuilder()
            .setCustomId('additional')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('Anything else you\'d like to add?')
            .setTextInputComponent(additionalInput)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketOther(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_other_${interaction.user.id}`)
            .setTitle('Other Support Request');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        const assistanceInput = new TextInputBuilder()
            .setCustomId('assistance')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('How can we assist you?')
            .setTextInputComponent(assistanceInput)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketLearner(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_learner_${interaction.user.id}`)
            .setTitle('Learner Request');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Timezone
        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('When are you available ingame (in Game Time)?')
            .setTextInputComponent(timezoneInput)
        );

        // Confirm
        const confirmInput = new TextInputBuilder()
            .setCustomId('confirm')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('Confirm you\'ve read & understand requirements')
            .setTextInputComponent(confirmInput)
        );

        // Goals
        const assistanceInput = new TextInputBuilder()
            .setCustomId('goals')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('What are you hoping to get out of this ticket')
            .setTextInputComponent(assistanceInput)
        );

        // Mode
        const modeSelect = new StringSelectMenuBuilder()
            .setCustomId('mode')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Normal Mode').setValue('nm'),
                new StringSelectMenuOptionBuilder().setLabel('100% Enrage').setValue('100'),
            ])
            .setMaxValues(2);

        modal.addLabelComponents(label => label
            .setLabel('What do you want to learn? (Select any)')
            .setStringSelectMenuComponent(modeSelect)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketLoreBook(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_lorebook_${interaction.user.id}`)
            .setTitle('Lore Book Crew staff application');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Timezone
        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('When are you available ingame (in Game Time)?')
            .setTextInputComponent(timezoneInput)
        );

        // Reason
        const reasonsInput = new TextInputBuilder()
            .setCustomId('reasons')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('Why are you applying for this role?')
            .setTextInputComponent(reasonsInput)
        );

        // presetkc
        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(false);

        modal.addLabelComponents(label => label
            .setLabel('Please provide your preset and kc')
            .setFileUploadComponent(fileUpload)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketLoreBookKill(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_lorebookkill_${interaction.user.id}`)
            .setTitle('Lore Book Kill Request');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Timezone
        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('When are you available ingame (in Game Time)?')
            .setTextInputComponent(timezoneInput)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketSupport(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_support_${interaction.user.id}`)
            .setTitle('Support Team staff application');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Timezone
        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('When are you available ingame (in Game Time)?')
            .setTextInputComponent(timezoneInput)
        );

        // Reason
        const reasonsInput = new TextInputBuilder()
            .setCustomId('reasons')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('Why are you applying for this role?')
            .setTextInputComponent(reasonsInput)
        );

        // presetkc
        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(false);

        modal.addLabelComponents(label => label
            .setLabel('Please provide your preset and kc')
            .setFileUploadComponent(fileUpload)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketTeacher(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_teacher_${interaction.user.id}`)
            .setTitle('Teacher Team staff application');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Timezone
        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('When are you available ingame (in Game Time)?')
            .setTextInputComponent(timezoneInput)
        );

        // Reason
        const reasonsInput = new TextInputBuilder()
            .setCustomId('reasons')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('Why are you applying for this role?')
            .setTextInputComponent(reasonsInput)
        );

        // Enrage
        const modeSelect = new StringSelectMenuBuilder()
            .setCustomId('enrage')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Normal Mode').setValue('nm'),
                new StringSelectMenuOptionBuilder().setLabel('100% Enrage').setValue('100'),
                new StringSelectMenuOptionBuilder().setLabel('500% Enrage').setValue('500'),
                new StringSelectMenuOptionBuilder().setLabel('750% Enrage').setValue('750'),
                new StringSelectMenuOptionBuilder().setLabel('1000% Enrage').setValue('1000'),
                new StringSelectMenuOptionBuilder().setLabel('2000% Enrage').setValue('2000'),
                new StringSelectMenuOptionBuilder().setLabel('4000% Enrage').setValue('4000'),
            ])
            .setMaxValues(7);

        modal.addLabelComponents(label => label
            .setLabel('Which enrage do you want to teach people?')
            .setStringSelectMenuComponent(modeSelect)
        );

        // presetkc
        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(false);

        modal.addLabelComponents(label => label
            .setLabel('Please provide your preset and kc')
            .setFileUploadComponent(fileUpload)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketTrialTeam(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_trialteam_${interaction.user.id}`)
            .setTitle('Trial Team staff application');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN (RuneScape Name)')
            .setTextInputComponent(rsnInput)
        );

        // Timezone
        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('When are you available ingame (in Game Time)?')
            .setTextInputComponent(timezoneInput)
        );

        // Reason
        const reasonsInput = new TextInputBuilder()
            .setCustomId('reasons')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('Why are you applying for this role?')
            .setTextInputComponent(reasonsInput)
        );

        // Enrage
        const modeSelect = new StringSelectMenuBuilder()
            .setCustomId('enrage')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('1000% Enrage').setValue('1000'),
                new StringSelectMenuOptionBuilder().setLabel('2000% Enrage').setValue('2000'),
            ])
            .setMaxValues(2);

        modal.addLabelComponents(label => label
            .setLabel('Which enrage do you want to trial people?')
            .setStringSelectMenuComponent(modeSelect)
        );

        // presetkc
        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(false);

        modal.addLabelComponents(label => label
            .setLabel('Please provide your preset and kc')
            .setFileUploadComponent(fileUpload)
        );
        await interaction.showModal(modal);
    }

    private async handleTicketTrialee(interaction: ButtonInteraction<'cached'>): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`ticket:create_trialee_${interaction.user.id}`)
            .setTitle('Trial Request');

        // RSN
        const rsnInput = new TextInputBuilder()
            .setCustomId('rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label
            .setLabel('Your RSN and preferred role')
            .setTextInputComponent(rsnInput)
        );

        // Timezone
        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('When are you available ingame (in Game Time)?')
            .setTextInputComponent(timezoneInput)
        );

        // Goals
        const assistanceInput = new TextInputBuilder()
            .setCustomId('secretword')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('What is the secret word?')
            .setTextInputComponent(assistanceInput)
        );

        // Tier
        const tierSelect = new StringSelectMenuBuilder()
            .setCustomId('tier')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Elite - 1000% Enrage').setValue('elite1000'),
                new StringSelectMenuOptionBuilder().setLabel('Elite - 2000% Enrage').setValue('elite2000'),

                new StringSelectMenuOptionBuilder().setLabel('Master - 1000% Enrage').setValue('master1000'),
                new StringSelectMenuOptionBuilder().setLabel('Master - 2000% Enrage').setValue('master2000'),

                // new StringSelectMenuOptionBuilder().setLabel('Grandmaster - 500% Enrage').setValue('gm500'),
                // new StringSelectMenuOptionBuilder().setLabel('Grandmaster - 1000% Enrage').setValue('gm1000'),
                // new StringSelectMenuOptionBuilder().setLabel('Grandmaster - 2000% Enrage').setValue('gm2000'),
            ])
            .setMaxValues(1);

        modal.addLabelComponents(label => label
            .setLabel('Which tier do you want to trial for?')
            .setStringSelectMenuComponent(tierSelect)
        );

        // presetkc
        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(false);

        modal.addLabelComponents(label => label
            .setLabel('Please provide your preset and kc')
            .setFileUploadComponent(fileUpload)
        );

        await interaction.showModal(modal);
    }

    private async handleTicketModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
                    formData.user_select = interaction.fields.getSelectedUsers('user_select');
                    formData.reported_user = interaction.fields.getTextInputValue('reported_user');
                    formData.reason = interaction.fields.getTextInputValue('reason');
                    formData.attachment = interaction.fields.getUploadedFiles('attachment');
                    break;
                case 'trialreport':
                    formData.user_report = interaction.fields.getSelectedUsers('user_report');
                    formData.reported_user = interaction.fields.getTextInputValue('reported_user');
                    formData.reason = interaction.fields.getTextInputValue('reason');
                    formData.attachment = interaction.fields.getUploadedFiles('attachment');
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
                    formData.mode = interaction.fields.getStringSelectValues('mode').join('-');
                    break;
                case 'lorebook':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.reasons = interaction.fields.getTextInputValue('reasons');
                    formData.attachment = interaction.fields.getUploadedFiles('attachment');
                    break;
                case 'lorebookkill':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    break;
                case 'support':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.reasons = interaction.fields.getTextInputValue('reasons');
                    formData.attachment = interaction.fields.getUploadedFiles('attachment');
                    break;
                case 'teacher':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.reasons = interaction.fields.getTextInputValue('reasons');
                    formData.attachment = interaction.fields.getUploadedFiles('attachment');
                    formData.enrage = interaction.fields.getStringSelectValues('enrage');
                    break;
                case 'trialteam':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.reasons = interaction.fields.getTextInputValue('reasons');
                    formData.attachment = interaction.fields.getUploadedFiles('attachment');
                    formData.enrage = interaction.fields.getStringSelectValues('enrage');
                    break;
                case 'trialee':
                    formData.timezone = interaction.fields.getTextInputValue('timezone');
                    formData.secretword = interaction.fields.getTextInputValue('secretword');
                    formData.tier = interaction.fields.getStringSelectValues('tier')[0];
                    formData.attachment = interaction.fields.getUploadedFiles('attachment');
                    break;
            }

            // customAutomod submission data before continue
            if (ticketType === 'other') {
                let automodResult = UtilityHandler.checkAutomod(formData.assistance);

                if (automodResult.ban || automodResult.timeout) {
                    // punish and dont continue with ticket creation
                    if (automodResult.timeout || automodResult.ban) {
                        const adminChannelId = this.client.channelIds.admin;
                        const adminChannel = await this.client.channels.fetch(adminChannelId) as TextChannel;

                        const banChannelId = this.client.channelIds.autoBanLogs;
                        const banChannel = await this.client.channels.fetch(banChannelId) as TextChannel;

                        let duration = "1d";

                        const container = this.client.cv2.getContainerBuilder(false, "Suspicious Account");
                        container.addTextDisplayComponents(builder => builder.setContent(`${interaction.member?.user.tag} (<@${interaction.member?.id}>) was automatically ${automodResult.ban ? 'banned' : 'timeouted'}.\n\n**Evidence:** \`${automodResult.evidence}\`\n\n**Reason:** \`${automodResult.reason}\`\n\n**Reference:** ${formData.assistance}`));

                        if (formData.assistance) {
                            container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
                            container.addTextDisplayComponents(builder => builder.setContent('Message Content:'));
                            container.addTextDisplayComponents(builder => builder.setContent(formData.assistance));
                        }

                        if (automodResult.ban) {
                            await banChannel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });

                            await interaction.member!.ban({ reason: automodResult.reason, deleteMessageSeconds: 604800 }).then(() => {
                                this.client.logger.log({ message: `Automatically banned user with id ${interaction.member?.id} for reason ${automodResult.reason} with evidence ${automodResult.evidence}` }, true)
                            }).catch((err) => {
                                this.client.logger.error({ message: `Error banning user with id ${interaction.member?.id} for reason ${automodResult.reason} with evidence ${automodResult.evidence}`, error: err.stack });
                            });
                        } else {
                            await adminChannel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });

                            const { timeout } = this.client.util;
                            const timeoutUser = timeout.bind(this.client.util);

                            if (await timeoutUser(null, interaction.member!, duration, automodResult.reason)) {
                                this.client.logger.log({ message: `Automatically timeouted user with id ${interaction.member?.id} for reason ${automodResult.reason} with evidence ${automodResult.evidence}` }, true);
                            } else {
                                this.client.logger.error({ message: `Automatically timeouted user with id ${interaction.member?.id} for reason ${automodResult.reason} with evidence ${automodResult.evidence}`, error: null });
                            }
                        }
                    }

                    await interaction.editReply('bye');
                    return;
                }
            }

            // sit non reading nerds
            if (ticketType === 'trialee') {
                const secretWord = formData.secretword.toLowerCase().trim();
                if (!secretWord.includes('easyread')) {
                    await interaction.editReply({
                        content: 'The secret word you provided is incorrect. Please read the channel and try again.'
                    });
                    return;
                }
            }

            const ticketNumber = await this.getNextTicketNumber(ticketType);

            const ticketChannel = await this.createTicketChannel(
                interaction.guild,
                ticketType,
                interaction.user.id,
                ticketNumber,
                ticketType === 'learner' ? formData.mode : null,
                formData
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

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
                ticketNumber,
                null
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

    private async handleContextCreateClearanceTicket(interaction: UserContextMenuCommandInteraction): Promise<void> {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const reportedUser: User = interaction.targetUser;
            const rsn: string = reportedUser.displayName;
            const description: string = 'clearance';

            const formData: any = {};
            formData.rsn = rsn;
            formData.discordid = reportedUser.id;
            formData.description = description;

            const ticketNumber = await this.getNextTicketNumber('clearance');

            const ticketChannel = await this.createTicketChannel(
                interaction.guild,
                'clearance',
                reportedUser.id,
                ticketNumber,
                null
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
                    if (overwrite.type === OverwriteType.Member && overwrite.allow.has('ViewChannel')) {
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

        if (channel.parentId === this.client.channelIds.learnerTicketsCategory) {
            const isTeacher = await this.client.util.hasRolePermissions(this.client, ['teacher'], interaction);
            if (isTeacher) return true;
        }

        if (channel.name.startsWith('lorebookkill')) {
            const isLoreBookCrew = await this.client.util.hasRolePermissions(this.client, ['lorebook', 'teacher'], interaction);
            if (isLoreBookCrew) return true;
        }

        if (channel.name.startsWith('trialee')) {
            const isTrialTeam = await this.client.util.hasRolePermissions(this.client, ['trialTeam'], interaction);
            if (isTrialTeam) return true;
        }

        if (channel.parentId === this.client.channelIds.vouchTicketsCategory) {
            const isTrialTeam = await this.client.util.hasRolePermissions(this.client, ['trialTeam'], interaction);
            if (isTrialTeam) return true;
        }

        if (channel.name.startsWith('clearance')) {
            return false;
        }

        const userPermissions = channel.permissionOverwrites.cache.get(interaction.user.id);

        return userPermissions !== undefined;
    }

    //#endregion

    //#region SUPPORT TEAM CONTROLS

    private async logTicketToForum(channel: TextChannel, user: any, logReason: string): Promise<string | null> {
        const messages = await UtilityHandler.readAllMessages(channel);
        const messageArray = Array.from(messages.values());

        const isLearnerTicket = channel.parentId === this.client.channelIds.learnerTicketsCategory;
        const displayChannelName = isLearnerTicket ? `learner-${channel.name}` : channel.name;

        const transcriptBuffer = await TranscriptGenerator.createTranscript(messages, displayChannelName, this.client);
        const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, { name: `${displayChannelName}-transcript.html` });

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

        const channelNameParts = displayChannelName.split('-');
        if (channelNameParts.length > 0) {
            ticketType = channelNameParts[0];
        }

        const ticketEmbedMessage = messages.find(msg =>
            msg.author.id === this.client.user?.id &&
            msg.embeds.length > 0 &&
            (msg.embeds[0].title?.includes('Ticket') || msg.embeds[0].title?.includes('Vouch')) &&
            !msg.embeds[0].title?.includes('Closed') &&
            msg.embeds[0].fields && msg.embeds[0].fields.length > 0
        );
        const originalTicketEmbed = ticketEmbedMessage?.embeds[0];

        let forumTitle = `${ticketType}-${ticketOpener}`;

        if (ticketType === 'vouch' && originalTicketEmbed?.fields) {
            const voucherField = originalTicketEmbed.fields.find(field => field.name === 'Voucher');
            const rsnField = originalTicketEmbed.fields.find(field => field.name === 'RSN');

            if (voucherField) {
                const voucherIdMatch = voucherField.value.match(/<@(\d+)>/);
                if (voucherIdMatch) {
                    const voucherId = voucherIdMatch[1];
                    try {
                        const guildUser = await channel.guild.members.fetch(voucherId);
                        ticketOpener = guildUser.user.username;
                    } catch {
                        ticketOpener = `User ID: ${voucherId}`;
                    }
                }
            }

            if (rsnField && rsnField.value) {
                forumTitle = `Vouch-${ticketOpener}-${rsnField.value}`;
            } else {
                forumTitle = `Vouch-${ticketOpener}`;
            }
        }

        if (ticketType === 'report' && originalTicketEmbed?.fields) {
            const reportedUserField = originalTicketEmbed.fields.find(field =>
                field.name === 'Reported Users'
            );

            if (reportedUserField) {
                const reportedUser = reportedUserField.value.replace(/```/g, '').replace(/(<@\d+>)/g, '').trim();
                forumTitle = `Report-${ticketOpener}-${reportedUser}`;
            }
        } else if (ticketType === 'clearance' && originalTicketEmbed?.fields) {
            const reportedUserField = originalTicketEmbed.fields.find(field =>
                field.name === 'RSN' || 'Reported Users'
            );

            if (reportedUserField) {
                const reportedUser = reportedUserField.value.replace(/```/g, '').trim();
                forumTitle = `Clearance-${reportedUser}`;
            }
        }

        const summaryEmbed = new EmbedBuilder()
            .setTitle(`Ticket Log: ${displayChannelName}`)
            .setColor(0x99ccff)
            .addFields(
                { name: 'Ticket Opener', value: ticketOpener, inline: false },
                { name: 'Ticket Type', value: ticketType, inline: false },
                { name: 'Log Generated By', value: `${user.username} (${user.id})`, inline: false },
                { name: 'Log Reason', value: logReason, inline: false },
                { name: 'Generated At', value: new Date().toISOString(), inline: false },
                { name: 'Channel', value: displayChannelName, inline: false },
                { name: 'Message Count', value: messageArray.length.toString(), inline: false }
            );

        const transcriptChannel = await channel.guild.channels.fetch(this.client.channelIds.tickets);
        if (!transcriptChannel) {
            throw new Error('Could not find the transcript channel.');
        }

        // Text channel path (e.g. vouch transcript channel)
        if (transcriptChannel.type !== ChannelType.GuildForum) {
            if (!transcriptChannel.isTextBased() || transcriptChannel.isThread()) {
                throw new Error('Transcript channel is not a supported channel type.');
            }
            const textChannel = transcriptChannel as TextChannel;
            const sentMessage = await textChannel.send({
                embeds: originalTicketEmbed ? [summaryEmbed, originalTicketEmbed] : [summaryEmbed],
                files: [transcriptAttachment]
            });
            return `msg:${textChannel.id}:${sentMessage.id}`;
        }

        const forumChannel = transcriptChannel;

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
                    //continue;
                    //we want that now.
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
                        const newUrl: string | null = await this.client.util.reuploadImage(attachment.url);

                        if (newUrl == null) {
                            continue;
                        }

                        const attachmentBlock = `**[${timeOnly}] ${author}:** ${newUrl}\n`;

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
        } catch (error) {
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
        const hasPermission = await this.canCloseTicket(interaction);
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

        } catch (error: any) {
            this.client.logger.error({
                message: 'Failed to delete ticket',
                error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
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
            if (overwrite.type === OverwriteType.Member && overwrite.allow.has('ViewChannel')) {
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
            message: `[Transcript] handleDMTranscriptDownload called with forumPostId: "${forumPostId}", user: ${interaction.user.id} / ${interaction.user.displayName}`,
            handler: 'ButtonHandler'
        }, true);

        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
            let transcriptAttachment: any;

            if (forumPostId.startsWith('msg:')) {
                const [, channelId, messageId] = forumPostId.split(':');
                client.logger.log({ message: `[Transcript] Text channel transcript. Channel: ${channelId}, Message: ${messageId}`, handler: 'ButtonHandler' }, true);
                const textChannel = await client.channels.fetch(channelId) as TextChannel;
                const message = await textChannel.messages.fetch(messageId);
                transcriptAttachment = message?.attachments.first();
            } else {
                client.logger.log({ message: `[Transcript] Fetching forum channel ${client.channelIds.tickets}...`, handler: 'ButtonHandler' }, true);
                const forumChannel = await client.channels.fetch(client.channelIds.tickets);
                if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
                    await interaction.editReply({ content: 'Error: Could not find the transcript archive.' });
                    return;
                }
                client.logger.log({ message: `[Transcript] Forum channel found. Fetching thread ${forumPostId}...`, handler: 'ButtonHandler' }, true);
                const thread = await forumChannel.threads.fetch(forumPostId);
                if (!thread) {
                    await interaction.editReply({ content: 'Error: Could not find the specific transcript for this ticket.' });
                    return;
                }
                const starterMessage = await thread.fetchStarterMessage();
                transcriptAttachment = starterMessage?.attachments.first();
            }

            if (!transcriptAttachment) {
                await interaction.editReply({ content: 'Error: The archived transcript is missing its attachment.' });
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
                await interaction.reply({ content: 'An unexpected error occurred while fetching your transcript. Please report this.', flags: MessageFlags.Ephemeral }).catch(() => { });
            } else {
                await interaction.editReply({ content: 'An unexpected error occurred while fetching your transcript. Please report this.' }).catch(() => { });
            }
        }
    }

    private async handleTranscriptDownload(interaction: ButtonInteraction, forumPostId: string): Promise<void> {
        this.client.logger.log({
            message: `[Transcript] handleTranscriptDownload called with forumPostId: "${forumPostId}", user: ${interaction.user.id} / ${interaction.user.displayName}`,
            handler: this.constructor.name
        }, true);

        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
            let transcriptAttachment: any;

            if (forumPostId.startsWith('msg:')) {
                const [, channelId, messageId] = forumPostId.split(':');
                this.client.logger.log({ message: `[Transcript] Text channel transcript. Channel: ${channelId}, Message: ${messageId}`, handler: this.constructor.name }, true);
                const textChannel = await this.client.channels.fetch(channelId) as TextChannel;
                const message = await textChannel.messages.fetch(messageId);
                transcriptAttachment = message?.attachments.first();
            } else {
                this.client.logger.log({ message: `[Transcript] Fetching forum channel ${this.client.channelIds.tickets}...`, handler: this.constructor.name }, true);
                const forumChannel = await this.client.channels.fetch(this.client.channelIds.tickets);
                if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
                    await interaction.editReply({ content: 'Error: Could not find the transcript archive.' });
                    return;
                }
                this.client.logger.log({ message: `[Transcript] Forum channel found. Fetching thread ${forumPostId}...`, handler: this.constructor.name }, true);
                const thread = await forumChannel.threads.fetch(forumPostId);
                if (!thread) {
                    await interaction.editReply({ content: 'Error: Could not find the specific transcript for this ticket.' });
                    return;
                }
                const starterMessage = await thread.fetchStarterMessage();
                transcriptAttachment = starterMessage?.attachments.first();
            }

            if (!transcriptAttachment) {
                await interaction.editReply({ content: 'Error: The archived transcript is missing its attachment.' });
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
                await interaction.reply({ content: 'An unexpected error occurred while fetching your transcript. Please report this.', flags: MessageFlags.Ephemeral }).catch(() => { });
            } else {
                await interaction.editReply({ content: 'An unexpected error occurred while fetching your transcript. Please report this.' }).catch(() => { });
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

    public async createTicketChannel(guild: any, ticketType: string, userId: string, ticketNumber: number, mode: string | null = null, formData: any | null = null): Promise<TextChannel | null> {
        try {
            let channelName = ticketType === 'learner'
                ? ticketNumber.toString().padStart(4, '0')
                : `${ticketType}-${ticketNumber.toString().padStart(4, '0')}`;

            if (mode != null) {
                channelName += `-${mode}`;
            }

            const isStaffTicket = ticketType === 'lorebook' || ticketType === 'support' || ticketType === 'teacher' || ticketType === 'trialteam';
            const isTrialReport = ticketType === 'trialreport';
            const isClearanceTicket = ticketType === 'clearance';
            const isReportTicket = ticketType === 'report';
            let parentCategoryId: string;

            switch (ticketType) {
                case 'learner':
                    parentCategoryId = this.client.channelIds.learnerTicketsCategory;
                    break;
                case 'lorebookkill':
                    parentCategoryId = this.client.channelIds.lorebookTicketsCategory;
                    break;
                case 'trialee':
                    switch (formData?.tier) {
                        case 'elite1000':
                            parentCategoryId = this.client.channelIds.trialee1000TicketsCategory;
                            break;
                        case 'elite2000':
                            parentCategoryId = this.client.channelIds.trialee2000TicketsCategory;
                            break;
                        case 'master1000':
                            parentCategoryId = this.client.channelIds.masterTrialee1000TicketsCategory;
                            break;
                        case 'master2000':
                            parentCategoryId = this.client.channelIds.masterTrialee2000TicketsCategory;
                            break;
                        default:
                            parentCategoryId = this.client.channelIds.trialeeTicketsCategory;
                    }
                    break;
                case 'lorebook':
                case 'support':
                case 'teacher':
                case 'trialteam':
                    parentCategoryId = this.client.channelIds.staffTicketsCategory;
                    break;
                case 'clearance':
                    parentCategoryId = this.client.channelIds.wipTicketCategory;
                    break;
                case 'trialreport':
                    parentCategoryId = this.client.channelIds.ticketCategory;
                    break;
                default:
                    parentCategoryId = this.client.channelIds.ticketCategory;
            }

            // Get admin and owner role IDs
            const adminRoleId = this.client.roleIds.admin;
            const ownerRoleId = this.client.roleIds.owner;
            const teacherRoleId = this.client.roleIds.teacher;
            const lorebookRoleId = this.client.roleIds.lorebook;
            const trialTeamRoleId = this.client.roleIds.trialTeam;
            const reportPermsRoleId = this.client.roleIds.reportPerms;

            const member = await guild.members.fetch(userId);

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
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageThreads
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

            if (ticketType === 'lorebookkill') {
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

                await channel.permissionOverwrites.create(
                    lorebookRoleId,
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

            if (ticketType === 'trialreport') {
                await channel.permissionOverwrites.create(
                    reportPermsRoleId,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        AttachFiles: true,
                        EmbedLinks: true,
                        ManageMessages: true,
                        ManageChannels: true,
                        ManageThreads: true,
                    }
                );
            }

            if (ticketType === 'trialee') {
                await channel.permissionOverwrites.create(
                    trialTeamRoleId,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        AttachFiles: true,
                        EmbedLinks: true,
                        ManageMessages: true,
                        ManageChannels: true,
                        ManageThreads: true,
                    }
                );

                // give user the notify role for trialees
                switch (formData.tier) {
                    case 'elite1000':
                        await member.roles.add(this.client.roleIds.elite1000trialee).catch(() => { });
                        break;

                    case 'elite2000':
                        await member.roles.add(this.client.roleIds.elite2000trialee).catch(() => { });
                        break;

                    case 'master1000':
                        await member.roles.add(this.client.roleIds.master1000trialee).catch(() => { });
                        break;

                    case 'master2000':
                        await member.roles.add(this.client.roleIds.master2000trialee).catch(() => { });
                        break;

                    default:
                        break;
                }
            }

            if (isStaffTicket || isReportTicket || isClearanceTicket || isTrialReport) {
                const adminRole = this.client.roles.admin;
                const ownerRole = this.client.roles.owner;


                const thread = await channel.threads.create({
                    name: isStaffTicket ? `Discussion - ${member.displayName}`
                        : isReportTicket ? `Report - ${member.displayName}`
                            : isClearanceTicket ? `Clearance - ${member.displayName}`
                                : isTrialReport ? `TrialReport - ${member.displayName}`
                                    : `Undefined - ${member.displayName}`,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                    type: ChannelType.PrivateThread,
                    reason: 'Thread automatically created by TicketHandler'
                });

                if (isStaffTicket) {
                    await thread.send(`${adminRole}, ${ownerRole}: Discuss the applicant here`);
                } else if (isReportTicket) {
                    await thread.send(`${adminRole}, ${ownerRole}: Speak as the bot here`);

                    if (formData?.user_select) {
                        for (const [_, user] of formData?.user_select) {
                            // check if reported users have warnings
                            const warning = await this.client.util.GetWarnings(user);

                            if (warning) {
                                await thread.send({
                                    components: [warning],
                                    flags: MessageFlags.IsComponentsV2,
                                    allowedMentions: { "parse": [] }
                                });
                            }
                        }
                    }
                } else if (isTrialReport) {
                    await thread.send(`Discuss the trial report here`);


                } else if (isClearanceTicket) {
                    await thread.send(`Any messages sent in this channel will be sent as the bot in the main ticket channel.`);
                    const member: GuildMember = await guild.members.fetch(userId);

                    const warning = await this.client.util.GetWarnings(member.user);

                    if (warning) {
                        await thread.send({
                            components: [warning],
                            flags: MessageFlags.IsComponentsV2,
                            allowedMentions: { "parse": [] }
                        });
                    }
                }
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
            const trialTeamRole = this.client.roles.trialTeam;
            const isStaffTicket = ticketType === 'lorebook' || ticketType === 'support' || ticketType === 'teacher' || ticketType === 'trialteam';

            // Create welcome message
            let welcomeMessage = `<@${userId}>, your ticket has been created. An ${isStaffTicket || ticketType === 'report' ? 'Admin' : adminRole} or ${isStaffTicket ? 'Owner' : ownerRole} will be with you shortly.`;

            if (ticketType === 'learner') {
                welcomeMessage = `<@${userId}>, your ticket has been created. Someone will be with you shortly.`;
            }

            if (ticketType === 'lorebookkill') {
                welcomeMessage = `<@${userId}>, your ticket has been created. Someone will be with you shortly.`;
            }

            if (ticketType === 'clearance') {
                welcomeMessage = 'Your clearance ticket has been created.';
            }

            if (ticketType === 'trialee') {
                welcomeMessage = `<@${userId}>, your ticket has been created. Someone will be with you shortly.`;
            }
            if (ticketType === 'trialreport') {
                welcomeMessage = `<@${userId}>, your ticket has been created. Someone will be with you shortly.`;
            }
            // Create embed with form data using fields for better organization
            const embed = new EmbedBuilder()
                .setTitle(`${ticketType === 'trialteam' ? 'Trial Team' : ticketType === 'lorebook' ? 'Lore Book Crew' : ticketType === 'lorebookkill' ? 'Lore Book Kill' : ticketType === 'trialreport' ? 'Trial Report' : capitalizeFirstLetter(ticketType)} Ticket`)
                .setColor(this.client.color)
                .setTimestamp();

            if (ticketType === 'clearance') {
                embed.setAuthor({
                    name: `User: ${this.client.user?.username}`,
                    iconURL: this.client.user?.displayAvatarURL()
                });
            } else {
                embed.setAuthor({
                    name: `User: ${channel.guild.members.cache.get(userId)?.user.username || 'Unknown User'}`,
                    iconURL: channel.guild.members.cache.get(userId)?.user.displayAvatarURL() || undefined
                });
            }

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
                    let reportedUsers: string = '';
                    if (formData.user_select) {
                        for (const [_, user] of formData.user_select) {
                            reportedUsers += `<@${user.id}>\n`;
                        }
                    }

                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Reported Users', value: `${reportedUsers.trim()}\n\`\`\`${formData.reported_user}\`\`\``, inline: false },
                        { name: 'Reason', value: `\`\`\`${formData.reason}\`\`\``, inline: false },
                    );
                    urls = urls.concat(formData.reason.match(urlRegex) || []);
                    break;
                case 'trialreport':
                    let reportedUser: string = '';
                    if (formData.user_report) {
                        for (const [_, user] of formData.user_report) {
                            reportedUser += `<@${user.id}>\n`;
                        }
                    }

                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Reported Users', value: `${reportedUser.trim()}\n\`\`\`${formData.reported_user}\`\`\``, inline: false },
                        { name: 'Reason', value: `\`\`\`${formData.reason}\`\`\``, inline: false },
                    );
                    urls = urls.concat(formData.reason.match(urlRegex) || []);
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
                        { name: 'When are you available ingame (in Game Time)?', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Confirm you\'ve read & understand requirements', value: `\`\`\`${formData.confirm}\`\`\``, inline: false },
                        { name: 'What are you hoping to get out of this ticket?', value: `\`\`\`${formData.goals}\`\`\``, inline: false },
                        { name: 'Mode and Enrage', value: `\`\`\`${formData.mode}\`\`\``, inline: false },
                    );
                    urls = urls.concat(formData.goals.match(urlRegex) || []);
                    break;
                case 'lorebook':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'When are you available ingame (in Game Time)?', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Why are you applying for this role?', value: `\`\`\`${formData.reasons}\`\`\``, inline: false }
                    );
                    urls = urls.concat(formData.reasons.match(urlRegex) || []);
                    break;
                case 'lorebookkill':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'When are you available ingame (in Game Time)?', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                    );
                    break;
                case 'support':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'When are you available ingame (in Game Time)?', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Why are you applying for this role?', value: `\`\`\`${formData.reasons}\`\`\``, inline: false }
                    );
                    urls = urls.concat(formData.reasons.match(urlRegex) || []);
                    break;
                case 'teacher':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'When are you available ingame (in Game Time)?', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Which enrage do you want to teach people', value: `\`\`\`${formData.enrage}\`\`\``, inline: false },
                        { name: 'Why are you applying for this role?', value: `\`\`\`${formData.reasons}\`\`\``, inline: false }
                    );

                    urls = urls.concat(formData.reasons.match(urlRegex) || []);
                    break;
                case 'trialteam':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'When are you available ingame (in Game Time)?', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'Which enrage do you want to trial people', value: `\`\`\`${formData.enrage}\`\`\``, inline: false },
                        { name: 'Why are you applying for this role?', value: `\`\`\`${formData.reasons}\`\`\``, inline: false }
                    );

                    urls = urls.concat(formData.reasons.match(urlRegex) || []);
                    break;
                case 'trialee':
                    embed.addFields(
                        { name: 'Your RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'When are you available ingame (in Game Time)?', value: `\`\`\`${formData.timezone}\`\`\``, inline: false },
                        { name: 'What is the secret word?', value: `\`\`\`${formData.secretword}\`\`\``, inline: false },
                        { name: 'Which tier do you want to trial for?', value: `\`\`\`${formData.tier}\`\`\``, inline: false },
                    );
                    break;
            }

            if (formData.attachment) {
                for (const [_, image] of formData.attachment) {
                    urls.push(image.url);
                }
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
                    '- Please change your discord nickname to your RSN if you haven\'t already',
                    '- Before your scheduled hour, please review <#1404510914526580837> and the roles found in <#1405324280522346657>',
                    '- Some mechanics include the distinction between red, blue and green colours, please let us know if you are colourblind to accomodate for that'
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
                            .setStyle(ButtonStyle.Secondary)
                    ]
                ));
                container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                    [
                        new ButtonBuilder()
                            .setCustomId('host_learner_quickfinish')
                            .setLabel('Complete ticket')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                ));

                await channel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { 'parse': [] }
                });
            }

            if (ticketType === 'lorebookkill') {
                const container = this.client.cv2.getContainerBuilder(null, '## Additional information');
                container.addTextDisplayComponents(builder => builder.setContent([
                    '- Please change your discord nickname to your RSN if you haven\'t already',
                    '- Before your scheduled kill, please review <#1404510914526580837> and the roles found in <#1405324280522346657>',
                    '- Some mechanics include the distinction between red, blue and green colours, please let us know if you are colourblind to accomodate for that'
                ].join('\n')));

                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
                container.addTextDisplayComponents(builder => builder.setContent('### Lore Book Crew Controls'));
                container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                    [
                        new ButtonBuilder()
                            .setCustomId('host_lorebook_post_nm')
                            .setLabel('Host Normal Mode')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('host_lorebook_quickfinish')
                            .setLabel('Complete ticket')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                ));

                await channel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { 'parse': [] }
                });
            }

            if (ticketType === 'trialee') {
                const thread = await channel.threads.create({
                    name: 'Trial Team Controls',
                    type: ChannelType.PrivateThread,
                    invitable: false,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                    reason: 'Trial team controls thread'
                });

                await thread.send({
                    content: trialTeamRole,
                    allowedMentions: { parse: ['roles'] }
                });

                const targetTrialRole = formData?.tier ? this.client.roles[formData.tier] : null;
                const container = this.client.cv2.getContainerBuilder(null, 'Trials - Post a quick host card');

                if (targetTrialRole) {
                    container.addTextDisplayComponents(builder => builder.setContent(`Target role: ${targetTrialRole}\nPassing the trial will assign this stored ticket tier and the relevant umbrella roles.`));
                    container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
                }

                container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                    [
                        new ButtonBuilder()
                            .setCustomId(`host_trial_post_${formData.tier}`)
                            .setLabel('Host Trial')
                            .setStyle(ButtonStyle.Secondary),
                    ]
                ));

                await thread.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] }
                });
            }

            if (urls.length > 0) {
                await channel.send(`Found following URL's / attachments:\n${urls.join('\n\n')}`);
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
            case 'lorebook':
                ticketObject.ticketType = 6;
            case 'support':
                ticketObject.ticketType = 7;
            case 'teacher':
                ticketObject.ticketType = 8;
            case 'trialteam':
                ticketObject.ticketType = 9;
            case 'lorebookkill':
                ticketObject.ticketType = 10;
            case 'trialee':
                ticketObject.ticketType = 11;
            case 'trialreport':
                ticketObject.ticketType = 12;
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

    //#region MessageSync

    public static async syncMessage(client: Bot, message: Message<true>) {
        if ((message.channel.parentId === client.channelIds.ticketCategory || message.channel.parentId === client.channelIds.wipTicketCategory)) {
            // Message is sent in a report-channel -> sync to thread
            const threads = await (message.channel as TextChannel).threads.fetch();

            if (threads) {
                const thread = threads.threads.first();

                let attachments = [];

                if (message.attachments?.size > 0) {
                    for (const [_, attachment] of message.attachments) {
                        attachments.push(attachment);
                    }
                }

                const messageContent = `${message.author.displayName}: ${message.content}`;
                await thread?.send(attachments.length > 0 ? { content: messageContent, files: attachments, allowedMentions: { "parse": [] } } : { content: messageContent, allowedMentions: { "parse": [] } });
            }
        } else if ((message.channel.parent?.parentId === client.channelIds.ticketCategory || message.channel.parent?.parentId === client.channelIds.wipTicketCategory)) {
            // Message is sent in a report-channel-thread -> sync to channel
            const channel = message.channel.parent as TextChannel;
            let attachments = [];

            if (message.attachments?.size > 0) {
                for (const [_, attachment] of message.attachments) {
                    attachments.push(attachment);
                }
            }

            await channel.send(attachments.length > 0 ? { content: message.content, files: attachments } : { content: message.content });
        }
    }

    //#endregion

    //#region Vouch Tickets

    public static async createVouchTicket(client: Bot, interaction: ChatInputCommandInteraction | ModalSubmitInteraction, targetUser: User, roleKey: string, vouches: Vouch[]): Promise<void> {
        const vouchCount = await client.dataSource.getRepository(Vouch).count();
        const channelName = `vouch-${vouchCount.toString().padStart(4, '0')}`;

        const permissionOverwrites: any[] = [
            {
                id: interaction.guild!.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: client.roleIds.admin,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                type: OverwriteType.Role
            },
            {
                id: client.roleIds.owner,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                type: OverwriteType.Role
            }
        ];

        if (client.roleIds.trialTeam) {
            permissionOverwrites.push({
                id: client.roleIds.trialTeam,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                type: OverwriteType.Role
            });
        }

        if (client.roleIds.vouchTeam) {
            permissionOverwrites.push({
                id: client.roleIds.vouchTeam,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                type: OverwriteType.Role
            });
        }

        permissionOverwrites.push({
            id: targetUser.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            type: OverwriteType.Member
        });

        const ticketChannel = await interaction.guild?.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: client.channelIds.vouchTicketsCategory,
            permissionOverwrites
        }) as TextChannel;

        if (!ticketChannel) return;

        const vouchFields = vouches.map((v, i) => ({
            name: `Vouch ${i + 1}`,
            value: `**Voucher:** <@${v.voucher}>\n**RSN:** ${v.rsn}\n**Description:** ${v.description}`,
            inline: false
        }));

        const vouchEmbed = new EmbedBuilder()
            .setTitle('Elite Role Vouch - Approval Required')
            .setColor(client.color)
            .addFields(
                { name: 'Vouchee', value: `<@${targetUser.id}>`, inline: false },
                { name: 'Role', value: client.roles[roleKey], inline: false },
                ...vouchFields,
                { name: 'Votes', value: '✅ 0 | ❌ 0', inline: false }
            )
            .setTimestamp();

        const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('vouch_approve').setLabel('Approve').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('vouch_reject').setLabel('Reject').setStyle(ButtonStyle.Danger)
        );
        const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({ embeds: [vouchEmbed], components: [voteRow, controlRow] });

        const ticketRepository = client.dataSource.getRepository(Ticket);
        const ticket = ticketRepository.create({
            channelId: ticketChannel.id,
            userOpen: targetUser.id,
            ticketType: 3
        });
        await ticketRepository.save(ticket);

        const vouchRepository = client.dataSource.getRepository(Vouch);
        for (const vouch of vouches) {
            vouch.ticketChannelId = ticketChannel.id;
            vouch.ticketRole = roleKey;
            await vouchRepository.save(vouch);
        }

        await interaction.followUp({
            content: `Vouch ticket created for <@${targetUser.id}>: <#${ticketChannel.id}>`,
            flags: MessageFlags.Ephemeral
        });
    }

    //#endregion
}
