import BotInteraction from '../../types/BotInteraction';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
    AutocompleteInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    TextChannel
} from 'discord.js';
import { KillTimeSubmission } from '../../entity/KillTimeSubmission';

export default class KillTimeSubmit extends BotInteraction {
    get name() {
        return 'killtime-submit';
    }

    get description() {
        return 'Submit a new kill time to the leaderboard.';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('teamsize')
                    .setDescription('The size of your team.')
                    .setRequired(true)
                    .setAutocomplete(true))
            .addStringOption(option =>
                option.setName('killtime')
                    .setDescription('Your kill time (e.g., 1:23.4).')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('vodlink')
                    .setDescription('A link to the VOD of the kill.')
                    .setRequired(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        if (interaction.options.getFocused(true).name === 'teamsize') {
            const focusedValue = interaction.options.getFocused();
            const choices = ['Duo', '4 man'];
            const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice })),
            );
        }
    }

    async run(interaction: ChatInputCommandInteraction) {
        const teamSize = interaction.options.getString('teamsize', true);
        const killTime = interaction.options.getString('killtime', true);
        const vodLink = interaction.options.getString('vodlink', true);

        const modal = new ModalBuilder()
            .setCustomId(`killtime_submission_${interaction.id}`)
            .setTitle('Kill Time Submission');

        const baseInput = new TextInputBuilder()
            .setCustomId('base_rsn')
            .setLabel('Base Tank RSN')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const dps1Input = new TextInputBuilder()
            .setCustomId('dps1_rsn')
            .setLabel('DPS #1 RSN')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const dps2Input = new TextInputBuilder()
            .setCustomId('dps2_rsn')
            .setLabel('DPS #2 RSN')
            .setStyle(TextInputStyle.Short)
            .setRequired(teamSize === '4 man');

        const dps3Input = new TextInputBuilder()
            .setCustomId('dps3_rsn')
            .setLabel('DPS #3 RSN')
            .setStyle(TextInputStyle.Short)
            .setRequired(teamSize === '4 man');

        const baseRow = new ActionRowBuilder<TextInputBuilder>().addComponents(baseInput);
        const dps1Row = new ActionRowBuilder<TextInputBuilder>().addComponents(dps1Input);

        if (teamSize === 'Duo') {
            modal.addComponents(baseRow, dps1Row);
        } else if (teamSize === '4 man') {
            const dps2Row = new ActionRowBuilder<TextInputBuilder>().addComponents(dps2Input);
            const dps3Row = new ActionRowBuilder<TextInputBuilder>().addComponents(dps3Input);
            modal.addComponents(baseRow, dps1Row, dps2Row, dps3Row);
        }

        await interaction.showModal(modal);

        const submitted = await interaction.awaitModalSubmit({
            time: 60000 * 5, // 5 minutes
            filter: i => i.customId === `killtime_submission_${interaction.id}`
        }).catch(() => {
            interaction.followUp({ content: 'Your submission timed out.', ephemeral: true });
            return null;
        });

        if (!submitted) return;

        await submitted.deferReply({ ephemeral: true });

        const baseRsn = submitted.fields.getTextInputValue('base_rsn');
        const dps1Rsn = submitted.fields.getTextInputValue('dps1_rsn');
        const dps2Rsn = teamSize === '4 man' ? submitted.fields.getTextInputValue('dps2_rsn') : undefined;
        const dps3Rsn = teamSize === '4 man' ? submitted.fields.getTextInputValue('dps3_rsn') : undefined;

        const killTimeRepository = this.client.dataSource.getRepository(KillTimeSubmission);
        const newSubmission = killTimeRepository.create({
            submitterId: interaction.user.id,
            teamSize,
            killTime,
            vodLink,
            base: baseRsn,
            dps1: dps1Rsn,
            dps2: dps2Rsn,
            dps3: dps3Rsn,
            status: 'pending',
        });
        const savedSubmission = await killTimeRepository.save(newSubmission);

        let teamDescription = `**Base:** ${baseRsn}\n**DPS 1:** ${dps1Rsn}`;
        if (teamSize === '4 man' && dps2Rsn && dps3Rsn) {
            teamDescription += `\n**DPS 2:** ${dps2Rsn}\n**DPS 3:** ${dps3Rsn}`;
        }

        const { colours, channels } = this.client.util;
        const submissionEmbed = new EmbedBuilder()
            .setColor(colours.lightblue)
            .setDescription(`
            **Submitter:** <@${interaction.user.id}>
            **Team Size:** ${teamSize}
            **Kill Time:** \`${killTime}\`
            **VOD Link:** [Click Here](${vodLink})

            **Team RSNs:**
            ${teamDescription}
            `)
            .setFooter({ text: `Submission ID: ${savedSubmission.id}` });

        const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('approveKillTime')
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('rejectKillTime')
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );

        const approvalChannel = await this.client.channels.fetch(channels.botRoleLog) as TextChannel;
        if (approvalChannel) {
        await approvalChannel.send({ embeds: [submissionEmbed], components: [buttons] });
        }

        await submitted.editReply({ content: 'Your submission has been sent for approval!' });
    }
} 