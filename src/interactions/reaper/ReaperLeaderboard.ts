import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Reaper } from '../../entity/Reaper';
import { ReaperParticipation } from '../../entity/ReaperParticipation';
import { getRoles } from '../../GuildSpecifics';

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
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('timespan')
                    .setDescription('The timespan for the leaderboard.')
                    .setRequired(true)
                    .setAutocomplete(true));
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

    async autocomplete(interaction: any) {
        const focusedOption = interaction.options.getFocused(true);
        let choices: string[] = [];
        if (focusedOption.name === 'timespan') {
            choices = ['Current Month', 'Last Month', 'Last 3 Months', 'Current Year', 'Last Year', 'All Time'];
        }

        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: false });
        const { dataSource } = this.client;
        const { colours } = this.client.util;
        const timespan = interaction.options.getString('timespan', true);

        const now = new Date();
        let startDate: Date | null = null;

        switch (timespan) {
            case 'Current Month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'Last Month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                now.setDate(0);
                break;
            case 'Last 3 Months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                break;
            case 'Current Year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'Last Year':
                startDate = new Date(now.getFullYear() - 1, 0, 1);
                now.setFullYear(now.getFullYear() - 1, 11, 31);
                break;
            case 'All Time':
            default:
                break;
        }

        const reapersHostedQuery = dataSource.createQueryBuilder()
            .select('reaper.host', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(Reaper, 'reaper')
            .groupBy('reaper.host')
            .orderBy('count', 'DESC');

        const reapersParticipatedQuery = dataSource.createQueryBuilder()
            .select('reaperParticipation.participant', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(ReaperParticipation, 'reaperParticipation')
            .leftJoin(Reaper, 'reaper', 'reaper.id = reaperParticipation.reaperId')
            .groupBy('reaperParticipation.participant')
            .orderBy('count', 'DESC');

        if (startDate) {
            reapersHostedQuery.where('reaper.created_at >= :startDate', { startDate });
            reapersParticipatedQuery.where('reaper.created_at >= :startDate', { startDate });
        }

        const reapersHosted = await reapersHostedQuery.getRawMany();
        const reapersParticipated = await reapersParticipatedQuery.getRawMany();

        let totalReapers = 0;
        reapersHosted.forEach((reaper: any) => {
            totalReapers += reaper.count;
        })

        const embed = new EmbedBuilder()
            .setTimestamp()
            .setTitle(`Amascut Reaper Team Leaderboard - ${timespan}`)
            .setColor(colours.tan)
            .setDescription(`> There has been **${totalReapers}** reaper${totalReapers !== 1 ? 's' : ''} recorded and **${reapersParticipated.length}** unique ${getRoles(interaction.guild?.id).reaper} members!`)
            .addFields(
                { name: 'Reapers Hosted', value: this.createFieldFromArray(reapersHosted.slice(0, 10)), inline: true },
                { name: 'Reapers Participated', value: this.createFieldFromArray(reapersParticipated.slice(0, 10)), inline: true }
            )

        await interaction.editReply({ embeds: [embed] });
    }
}
