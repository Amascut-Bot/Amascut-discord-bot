import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Reaper } from '../../entity/Reaper';
import { ReaperParticipation } from '../../entity/ReaperParticipation';

export default class ReaperLeaderboard extends BotInteraction {
    get name() {
        return 'reaper-leaderboard';
    }

    get description() {
        return 'Reaper Team Leaderboards';
    }

    get permissions() {
        return 'REAPER';
    }

    get slashData() {
        return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }

    public createFieldFromArray = (array: any[]) => {
        const { gem1, gem2, gem3 } = this.client.util.emojis;
        let field = '';
        if (array.length === 0) return 'None';
        const filteredArray = array.filter(item => !item.user.includes("Placeholder"));
        if (filteredArray.length === 0) return 'None';
        filteredArray.forEach((item, index) => {
            let prefix: string;
            switch (index) {
                case 0:
                    prefix = gem1;
                    break;
                case 1:
                    prefix = gem2
                    break;
                case 2:
                    prefix = gem3
                    break;
                default:
                    prefix = '⬥'
                    break;
            }
            field += `${prefix} <@${item.user}> - **${item.count}**\n`
        })
        return field;
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: false });
        const { dataSource } = this.client;
        const { colours, roles } = this.client.util;

        // Get top 10 Reapers hosted members
        const reapersHosted = await dataSource.createQueryBuilder()
            .select('reaper.host', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(Reaper, 'reaper')
            .groupBy('reaper.host')
            .orderBy('count', 'DESC')
            .getRawMany();

        // Get top 10 Reapers participated members
        const reapersParticipated = await dataSource.createQueryBuilder()
            .select('reaperParticipation.participant', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(ReaperParticipation, 'reaperParticipation')
            .groupBy('reaperParticipation.participant')
            .orderBy('count', 'DESC')
            .getRawMany();

        // Get total trials without making another database call
        let totalReapers = 0;
        reapersHosted.forEach((reaper: any) => {
            totalReapers += reaper.count;
        })

        const embed = new EmbedBuilder()
            .setTimestamp()
            .setTitle('Solak Reaper Team Leaderboard')
            .setColor(colours.tan)
            .setDescription(`> There has been **${totalReapers}** trial${totalReapers !== 1 ? 's' : ''} recorded and **${reapersParticipated.length}** unique ${roles.reaper} members!`)
            .addFields(
                { name: 'Reapers Hosted', value: this.createFieldFromArray(reapersHosted.slice(0, 10)), inline: true },
                { name: 'Reapers Participated', value: this.createFieldFromArray(reapersParticipated.slice(0, 10)), inline: true }
            )

        await interaction.editReply({ embeds: [embed] });
    }
}
