import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, TextChannel } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { DpmSubmission } from '../../entity/DpmSubmission';
import { getChannels, getRoles } from '../../GuildSpecifics';

export default class DPMSubmit extends BotInteraction {
    get name() {
        return 'dpm-submit';
    }

    get description() {
        return 'Submit your DPM for leaderboard consideration.';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('rsn').setDescription('Your RuneScape Name').setRequired(true))
            .addStringOption((option) =>
                option.setName('style')
                    .setDescription('The combat style used for the submission.')
                    .setRequired(true)
                    .setAutocomplete(true))
            .addStringOption((option) =>
                option.setName('teamsize')
                    .setDescription('The size of your team.')
                    .setRequired(true)
                    .setAutocomplete(true))
            .addStringOption((option) => option.setName('time').setDescription('The time of your kill in the format MM:SS. Ticks are supported, i.e. 1:23.4').setRequired(true))
            .addStringOption((option) => option.setName('damage').setDescription('The full amount of damage you did, i.e. for 100k damage, use 100000').setRequired(true))
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'style') {
            const focusedValue = focusedOption.value;
            const choices = ['Necromancy', 'Hybrid', 'Tribrid', 'Magic', 'Ranged', 'Melee'];
            const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice })),
            );
        } else if (focusedOption.name === 'teamsize') {
            const focusedValue = focusedOption.value;
            const choices = ['Duo', '4 man'];
            const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice })),
            );
        }
    }

    async run(interaction: ChatInputCommandInteraction) {
        const rsn: string = interaction.options.getString('rsn', true).toLowerCase();
        const style: string = interaction.options.getString('style', true);
        const teamSize: string = interaction.options.getString('teamsize', true);
        const time: string = interaction.options.getString('time', true);
        const damage: string = interaction.options.getString('damage', true);

        // Validate damage input
        if (isNaN(+damage)) {
            return await interaction.reply({ content: 'Invalid damage value. Please enter a number.', ephemeral: true });
        }

        // Calculate DPM
        const timeInSeconds = this.parseTime(time);
        if (timeInSeconds === null) {
            return await interaction.reply({ content: 'Invalid time format. Please use MM:SS or MM:SS.T format.', ephemeral: true });
        }

        const calcedDPM = (+damage / timeInSeconds) * 60 / 1000;

        const timestamp = Date.now();

        const modal = new ModalBuilder()
            .setCustomId(`dpm_screenshots_${interaction.user.id}_${timestamp}`)
            .setTitle('DPM Submission - Screenshots');

        const firstScreenshotInput = new TextInputBuilder()
            .setCustomId('first_screenshot')
            .setLabel('First Screenshot URL')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('https://imgur.com/example1.png');

        const secondScreenshotInput = new TextInputBuilder()
            .setCustomId('second_screenshot')
            .setLabel('Second Screenshot URL')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('https://imgur.com/example2.png');

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(firstScreenshotInput);
        const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(secondScreenshotInput);

        modal.addComponents(firstActionRow, secondActionRow);

        // Store submission
        const submissionData = {
            rsn,
            style,
            teamSize,
            time,
            damage,
            calcedDPM,
            userId: interaction.user.id
        };

        // Store in a temporary cache
        this.client.tempSubmissionData = this.client.tempSubmissionData || new Map();
        this.client.tempSubmissionData.set(`${interaction.user.id}_${timestamp}`, submissionData);

        await interaction.showModal(modal);
    }

    async handleModalSubmit(interaction: ModalSubmitInteraction) {
        if (!interaction.customId.startsWith('dpm_screenshots_')) return;

        this.client.logger.log({
            message: `Modal submit received: ${interaction.customId}`,
            handler: 'DPMSubmit'
        }, true);

        await interaction.deferReply({ ephemeral: true });

        // Extract timestamp from customId to get the stored data
        const timestamp = interaction.customId.split('_').pop();
        const cacheKey = `${interaction.user.id}_${timestamp}`;

        this.client.logger.log({
            message: `Looking for cache key: ${cacheKey}`,
            handler: 'DPMSubmit'
        }, true);

        const submissionData = this.client.tempSubmissionData?.get(cacheKey);
        if (!submissionData) {
            this.client.logger.log({
                message: `Submission data not found for key: ${cacheKey}. Available keys: ${Array.from(this.client.tempSubmissionData?.keys() || [])}`,
                handler: 'DPMSubmit'
            }, true);
            return await interaction.editReply({ content: 'Submission data not found. Please try again.' });
        }

        this.client.logger.log({
            message: `Found submission data for ${submissionData.rsn}`,
            handler: 'DPMSubmit'
        }, true);

        // Clean up temporary data
        this.client.tempSubmissionData?.delete(cacheKey);

        const firstScreenshot = interaction.fields.getTextInputValue('first_screenshot');
        const secondScreenshot = interaction.fields.getTextInputValue('second_screenshot');

        // Validate URLs
        if (!this.isValidUrl(firstScreenshot) || !this.isValidUrl(secondScreenshot)) {
            return await interaction.editReply({ content: 'Invalid screenshot URLs. Please provide valid HTTP/HTTPS URLs.' });
        }

        const { rsn, style, teamSize, time, damage, calcedDPM } = submissionData;

        // Get role based on DPM
        const roleId = await this.client.util.getDpmRole(calcedDPM);

        // Save submission to database with pending status
        const dpmSubmission = new DpmSubmission();
        dpmSubmission.userId = interaction.user.id;
        dpmSubmission.rsn = rsn;
        dpmSubmission.style = style;
        dpmSubmission.teamSize = teamSize;
        dpmSubmission.dpm = calcedDPM;
        dpmSubmission.damage = damage;
        dpmSubmission.time = time;
        dpmSubmission.roleId = roleId;
        dpmSubmission.firstScreenshot = firstScreenshot;
        dpmSubmission.secondScreenshot = secondScreenshot;
        dpmSubmission.approvedBy = '';
        dpmSubmission.status = 'pending';

        const savedSubmission = await this.client.dataSource.getRepository(DpmSubmission).save(dpmSubmission);

        // Create submission embed (keeping exact same format)
        const { colours } = this.client.util;
        const submissionEmbed = new EmbedBuilder()
            .setTitle('DPM Submission')
            .setColor(colours.lightblue)
            .setDescription(`
            **Submitter:** <@${interaction.user.id}>
            **RSN:** \`${rsn}\`
            **Style:** \`${style}\`
            **Team Size:** \`${teamSize}\`
            **Damage:** \`${(+damage).toLocaleString()}\`
            **Time:** \`${time}\`
            **DPM:** \`${calcedDPM.toFixed(2)}k\`
            **Role:** <@&${roleId}>`)
            .setFooter({ text: `Submission ID: ${savedSubmission.id}` });

        const approveButton = new ButtonBuilder()
                    .setCustomId('approveDPM')
                    .setLabel('Approve')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
                    .setCustomId('rejectDPM')
                    .setLabel('Reject')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);

        // Send to admin channel
        const adminChannel = this.client.channels.cache.get(getChannels(interaction.guild?.id).botRoleLog) as TextChannel;
        if (adminChannel?.isTextBased()) {
            await adminChannel.send(`**First Screenshot:** ${firstScreenshot}\n**Second Screenshot:** ${secondScreenshot}`);
            await adminChannel.send({ embeds: [submissionEmbed], components: [actionRow] });
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('Your DPM submission has been received!')
            .setColor(colours.discord.green)
            .setDescription(`An ${getRoles(interaction.guild?.id).admin} will review your submission and handle it shortly.`);
        return await interaction.editReply({ embeds: [successEmbed] });
    }

    private parseTime(timeString: string): number | null {
        const timeRegex = /^(\d+):(\d{2})(?:\.(\d))?$/;
        const match = timeString.match(timeRegex);

        if (!match) return null;

        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const ticks = match[3] ? parseInt(match[3]) : 0;

        return minutes * 60 + seconds + ticks * 0.6;
    }

    private isValidUrl(string: string): boolean {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
}
