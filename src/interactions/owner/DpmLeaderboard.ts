import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';

const leaderboardConfigPath = path.join(process.cwd(), 'leaderboard-config.json');

export default class DpmLeaderboard extends BotInteraction {
    get name() {
        return 'dpm-leaderboard';
    }

    get description() {
        return 'Manages the DPM leaderboard.';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('post')
                    .setDescription('Posts the DPM leaderboard in the current channel.')
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!this.client.util.config.owners.includes(interaction.user.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'post') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const leaderboardEmbeds = await this.client.util.generateDpmLeaderboardEmbeds();
            const channel = interaction.channel as TextChannel;

                const message = await channel.send({ embeds: leaderboardEmbeds });

                const leaderboardConfig = {
                    channelId: channel.id,
                messageId: message.id
            };

                await fs.writeFile(leaderboardConfigPath, JSON.stringify(leaderboardConfig, null, 2));

            await interaction.editReply({ content: `DPM leaderboard posted successfully. Config file has been updated.` });
            } catch (error) {
                this.client.logger.error({
                    message: 'Failed to post DPM leaderboard.',
                    error,
                    handler: this.constructor.name,
                });
                await interaction.editReply({ content: 'An error occurred while posting the DPM leaderboard.' });
            }
        }
    }
}
