import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction } from 'discord.js';
import { ReaperParticipation } from '../../entity/ReaperParticipation';
import { TrialParticipation } from '../../entity/TrialParticipation';
import { Reaper } from '../../entity/Reaper';
import { Trial } from '../../entity/Trial';

export default class Stats extends BotInteraction {
    get name() {
        return 'stats';
    }

    get description() {
        return 'Your Solak Discord user statistics!';
    }

    get slashData() {
        return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {

        const { dataSource } = this.client;
        const { colours, roles, stripRole } = this.client.util;

        await interaction.deferReply({ ephemeral: true });

        const user = await interaction.guild?.members.fetch(interaction.user.id);

        const errorEmbed = new EmbedBuilder()
            .setColor(colours.discord.red)
            .setDescription(`User object could not be found.`);

        if (!user) return await interaction.editReply({ embeds: [errorEmbed] });

        const userRoles = user?.roles.cache.map(role => role.id) || [];

        if (!userRoles.includes(stripRole(roles['trialTeam'])) && !userRoles.includes(stripRole(roles['reaper']))) {
            errorEmbed.setDescription(`You need ${roles.trialTeam} or ${roles.reaper} to use this command.`);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const userId = user.id;

        const reapersParticipated = await dataSource.createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from(ReaperParticipation, 'reaperParticipation')
            .where("reaperParticipation.participant = :userId", { userId })
            .getRawOne();

        const trialsParticipated = await dataSource.createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from(TrialParticipation, 'trialParticipation')
            .where("trialParticipation.participant = :userId", { userId })
            .getRawOne();

        const joinTime = user.joinedTimestamp ? `<t:${Math.round(user.joinedTimestamp / 1000)}:f>` : 'Unknown';
        let description = `\`\`Joined:\`\` ${joinTime}`;

        if (reapersParticipated.count) {
            description += `\n\n> ${roles.reaper}\n\n`
            const reapersHosted = await dataSource.createQueryBuilder()
                .select('COUNT(*)', 'count')
                .from(Reaper, 'reaper')
                .where("reaper.host = :userId", { userId })
                .getRawOne();
            if (reapersHosted.count) {
                description += `\`Host Score:\` **${reapersHosted.count}**\n`
            }
            description += `\`Participation Score:\` **${reapersParticipated.count}**`
        }

        if (trialsParticipated.count) {
            description += `\n\n> ${roles.trialTeam}\n\n`
            const trialsHosted = await dataSource.createQueryBuilder()
                .select('COUNT(*)', 'count')
                .from(Trial, 'trial')
                .where("trial.host = :userId", { userId })
                .getRawOne();
            if (trialsHosted.count) {
                description += `\`Host Score:\` **${trialsHosted.count}**\n`
            }
            description += `\`Participation Score:\` **${trialsParticipated.count}**`
        }

        const embed = new EmbedBuilder()
            .setColor(colours.gold)
            .setTitle(`Statistics for ${user.nickname ? user.nickname : interaction.user.tag}`)
            .setDescription(
                `${description}`
            )
            .setThumbnail(interaction.user.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png')
            .setTimestamp();
        await interaction.editReply({ embeds: [embed], components: [] });
    }
}
