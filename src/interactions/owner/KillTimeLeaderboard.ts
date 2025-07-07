import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';

const leaderboardConfigPath = path.join(process.cwd(), 'killtime-leaderboard-config.json');

export default class KillTimeLeaderboard extends BotInteraction {
    get name() {
        return 'killtime-leaderboard';
    }

    get description() {
        return 'Manages the Kill Time leaderboard.';
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
                    .setName('post')
                    .setDescription('Posts the Kill Time leaderboard in the current channel.')
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'post') {
            await interaction.deferReply({ ephemeral: true });

            const leaderboardEmbed = await this.client.util.generateKillTimeLeaderboardEmbed();
            const channel = interaction.channel as TextChannel;
            
            const message = await channel.send({ embeds: [leaderboardEmbed] });

            const config = {
                channelId: message.channel.id,
                messageId: message.id
            };

            await fs.writeFile(leaderboardConfigPath, JSON.stringify(config, null, 2));

            await interaction.editReply({ content: `Kill Time leaderboard posted successfully. Config file has been updated.` });
        }
    }
} 