import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { DpmSubmission } from '../../entity/DpmSubmission';
import { KillTimeSubmission } from '../../entity/KillTimeSubmission';
import * as fs from 'fs/promises';
import * as path from 'path';

const leaderboardConfigPath = path.join(process.cwd(), 'leaderboard-config.json');
const killTimeLeaderboardConfigPath = path.join(process.cwd(), 'killtime-leaderboard-config.json');

export default class RemoveSubmission extends BotInteraction {
    get name() {
        return 'remove-submission';
    }

    get description() {
        return 'Removes a submission from a leaderboard. (Owner only)';
    }

    get permissions() {
        return 'OWNER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('dpm')
                    .setDescription('Remove a submission from the DPM leaderboard')
                    .addIntegerOption(option =>
                        option.setName('id').setDescription('The ID of the submission to remove').setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('killtime')
                    .setDescription('Remove a submission from the Kill Time leaderboard')
                    .addIntegerOption(option =>
                        option.setName('id').setDescription('The ID of the submission to remove').setRequired(true)
                    )
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const submissionId = interaction.options.getInteger('id', true);

        if (subcommand === 'dpm') {
            const submissionRepository = this.client.dataSource.getRepository(DpmSubmission);
            try {
                const submission = await submissionRepository.findOneBy({ id: submissionId });
                if (!submission) {
                    return await interaction.editReply({ content: `A DPM submission with the ID \`${submissionId}\` was not found.` });
                }
                await submissionRepository.remove(submission);

                const dpmLeaderboards = await this.client.util.generateDpmLeaderboardEmbeds();
                try {
                    const config = JSON.parse(await fs.readFile(leaderboardConfigPath, 'utf-8'));
                    const message = await (this.client.channels.cache.get(config.channelId) as TextChannel).messages.fetch(config.messageId);
                    await message.edit({ embeds: dpmLeaderboards });
                } catch (err) {
                    this.client.logger.error({
                        message: 'Failed to update DPM leaderboard after submission removal.',
                        error: err,
                        handler: this.constructor.name,
                    });
                }

                return await interaction.editReply({ content: `Successfully removed DPM submission with ID \`${submissionId}\` and updated the leaderboard.` });
            } catch (error) {
                this.client.logger.error({
                    message: 'Failed to remove DPM submission.',
                    error,
                    handler: this.constructor.name,
                });
                return await interaction.editReply({ content: 'An error occurred while trying to remove the DPM submission.' });
            }
        }

        if (subcommand === 'killtime') {
            const submissionRepository = this.client.dataSource.getRepository(KillTimeSubmission);
            try {
                const submission = await submissionRepository.findOneBy({ id: submissionId });
                if (!submission) {
                    return await interaction.editReply({ content: `A Kill Time submission with the ID \`${submissionId}\` was not found.` });
                }
                await submissionRepository.remove(submission);

                const killTimeLeaderboard = await this.client.util.generateKillTimeLeaderboardEmbed();
                try {
                    const config = JSON.parse(await fs.readFile(killTimeLeaderboardConfigPath, 'utf-8'));
                    const message = await (this.client.channels.cache.get(config.channelId) as TextChannel).messages.fetch(config.messageId);
                    await message.edit({ embeds: [killTimeLeaderboard] });
                } catch (err) {
                    this.client.logger.error({
                        message: 'Failed to update Kill Time leaderboard after submission removal.',
                        error: err,
                        handler: this.constructor.name,
                    });
                }

                return await interaction.editReply({ content: `Successfully removed Kill Time submission with ID \`${submissionId}\` and updated the leaderboard.` });
            } catch (error) {
                this.client.logger.error({
                    message: 'Failed to remove Kill Time submission.',
                    error,
                    handler: this.constructor.name,
                });
                return await interaction.editReply({ content: 'An error occurred while trying to remove the Kill Time submission.' });
            }
        }
    }
} 