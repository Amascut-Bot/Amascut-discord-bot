import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, MessageFlags, User, Attachment, ContainerBuilder, SeparatorSpacingSize, MediaGalleryBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { DpmSubmission } from '../../entity/DpmSubmission';
import { getChannels, getRoles } from '../../GuildSpecifics';
import LeaderboardHandler from '../../modules/LeaderboardHandler';

export default class PostEnrageLeaderboard extends BotInteraction {
    get name() {
        return 'post-enrageleaderboard';
    }

    get description() {
        return 'Reposts the enrage leaderboard';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) return interaction.editReply('Command only available in guilds!');

        // Repost Leaderboard
        const leaderboardChannelId = getChannels(interaction.guild!.id).leaderboards;
        const leaderboardChannel = await interaction.guild!.channels.fetch(leaderboardChannelId) as TextChannel;
        await LeaderboardHandler.postLeaderboard(leaderboardChannel, this.client, interaction.guild!.id);


        await interaction.editReply(`Leaderboard reposted. Go to <#${leaderboardChannelId}> and check it out!`);
    }
}
