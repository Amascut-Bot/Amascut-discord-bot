import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import TwitchHandler from '../../modules/TwitchHandler';

export default class HealthCheck extends BotInteraction {
    get name() {
        return 'health-check';
    }

    get description() {
        return 'Check the health of the bot and its dependencies';
    }

    get permissions() {
        return 'BOT_OWNER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction<any>) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Check for roles, that are defined but no longer exists in the guild
        await interaction.editReply('*Checking GuildSpecifics Roles...*');

        for (const [key, role] of Object.entries(this.client.roleIds)) {
            if (!interaction.guild?.roles.cache.has(role)) {
                await interaction.followUp(`:x: Missing role for ${key}`);
            }
        }

        // Check for channels or categories, that are defined but no longer exists in the guild
        await interaction.editReply('*Checking GuildSpecifics Channels & Categories...*');

        for (const [key, channel] of Object.entries(this.client.channelIds)) {
            if (!interaction.guild?.channels.cache.has(channel)) {
                await interaction.followUp(`:x: Missing channel for ${key}`);
            }
        }

        // Check for orphaned streamers that are still mapped but no longer in the guild
        await interaction.editReply('*Checking for orphaned streamers...*');

        const streamers = await TwitchHandler.readStreamers();

        for (const streamer of streamers) {
            if (streamer.discordUserId != null && !interaction.guild?.members.cache.has(streamer.discordUserId)) {
                await interaction.followUp(`:x: Orphaned streamer found - ${streamer.displayName} (<@${streamer.discordUserId}>)`);
            }
        }

        await interaction.editReply(':white_check_mark: Health check completed!');
    }
}
