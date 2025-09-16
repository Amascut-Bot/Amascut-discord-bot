import { LearnerHour } from '../../entity/LearnerHour';
import { LearnerHourParticipation } from '../../entity/LearnerHourParticipation';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export default class TeacherLeaderboard extends BotInteraction {
    get name() {
        return 'teacher-leaderboard';
    }

    get description() {
        return 'Teacher Leaderboards';
    }

    get permissions() {
        return 'TEACHER';
    }

    get timespanOptions() {
        const timespanTypes: any = {
            'Current Month': 'currentMonth',
            'Last Month': 'lastMonth',
            'Last 3 Months': 'lastThreeMonths',
            'Current Year': 'currentYear',
            'Last Year': 'lastYear',
            'All Time': 'allTime',
        }
        const options: any = [];
        Object.keys(timespanTypes).forEach((key: string) => {
            options.push({ name: key, value: timespanTypes[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('timespan').setDescription('Time Span').addChoices(
                ...this.timespanOptions
            ).setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const { dataSource } = this.client;
        // const learnerHourRepository = dataSource.getRepository(LearnerHour);
        // const learnerHourParticipationRepository = dataSource.getRepository(LearnerHourParticipation);

        let timespan: string | null = interaction.options.getString('timespan', false);
        if (timespan == null){
            timespan = 'currentMonth';
        }

        let dateFrom: Date;
        let dateTo: Date;
        let timestamp: Date = new Date();
        let description: String;

        switch(timespan){
            case 'currentMonth':{
                dateFrom = new Date(timestamp.getFullYear(), timestamp.getMonth(), 1, 0, 0, 0);
                dateTo = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 23, 59, 59);
                description = 'Current Month';
                break;
            }
            case 'lastMonth':{
                timestamp.setDate(0);
                dateFrom = new Date(timestamp.getFullYear(), timestamp.getMonth(), 1, 0, 0, 0);
                dateTo = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 23, 59, 59);
                description = 'Last Month';
                break;
            }
            case 'lastThreeMonths':{
                dateTo = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 23, 59, 59);
                timestamp.setMonth(timestamp.getMonth() - 3);
                dateFrom = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 0, 0, 0);
                description = 'Last 3 Months';
                break;
            }
            case 'currentYear':{
                dateFrom = new Date(timestamp.getFullYear(), 1, 1, 0, 0, 0);
                dateTo = new Date(timestamp.getFullYear(), 12, 31, 23, 59, 59);
                description = 'Current Year';
                break;
            }
            case 'lastYear':{
                dateFrom = new Date(timestamp.getFullYear() - 1, 1, 1, 0, 0, 0);
                dateTo = new Date(timestamp.getFullYear() - 1, 12, 31, 23, 59, 59);
                description = 'Last Year';
                break;
            }
            default:{
                dateFrom = new Date(2000, 1, 1, 0, 0, 0);
                dateTo = new Date(2099, 31, 12, 23, 59, 59);
                description = 'All Time';
                break;
            }
        }

        // Get top 10 Trials hosted members
        const learnerHoursHosted = await dataSource.createQueryBuilder()
            .select('learnerHour.host', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(LearnerHour, 'learnerHour')
            .groupBy('learnerHour.host')
            .where(`learnerHour.createdAt BETWEEN :dateFrom AND :dateTo`, {dateFrom, dateTo})
            .andWhere(`learnerHour.host <> 'Placeholder'`)
            .orderBy('count', 'DESC')
            .getRawMany();

        // Get top 10 Trials participated members
        const learnerHoursParticipated = await dataSource.createQueryBuilder(LearnerHourParticipation, 'learnerHourParticipation')
        .innerJoinAndSelect('learnerHourParticipation.learnerHour', 'learnerHour')
        .addSelect('learnerHourParticipation.participant', 'user')
        .addSelect('COUNT(*)', 'count')
        .where(`learnerHour.createdAt BETWEEN :dateFrom AND :dateTo`, {dateFrom, dateTo})
        .groupBy('learnerHourParticipation.participant')
        .orderBy('count', 'DESC')
        .getRawMany();

        // Get total learner hours without making another database call
        let totalLearnerHours = 0;
        learnerHoursHosted.forEach(lh => {
            totalLearnerHours += lh.count;
        })

        const embed = new EmbedBuilder()
            .setTimestamp()
            .setTitle(`Learner Hour Leaderboard (${description})`)
            .setColor(this.client.color)
            .setDescription(`> There has been **${totalLearnerHours}** Learner Hour${totalLearnerHours !== 1 ? 's' : ''} recorded and **${learnerHoursParticipated.length}** unique ${this.client.roles.helperLearner} members!`)
            .addFields(
                { name: 'Learner Hours Hosted', value: this.createFieldFromArray(learnerHoursHosted.slice(0,10)), inline: true },
                { name: 'Learner Hours Participated', value: this.createFieldFromArray(learnerHoursParticipated.slice(0,10)), inline: true }
            )

        await interaction.editReply({ embeds: [embed] });

        // const learnerHours = await learnerHourRepository.find({
        //     where: {
        //         createdAt: Between(dateFrom, dateTo)
        //     }
        // });

        // const learnerHourParticipations = await learnerHourParticipationRepository.find({
        //     where: {
        //         createdAt: Between(dateFrom, dateTo)
        //     }
        // });

        // group by users
        // const hosts: Map<string, number> = new Map<string, number>();
        // for (const row of learnerHours) {
        //     hosts.set(row.host, (hosts.get(row.host) ?? 0) + 1);
        // }
        // const sortedHosts = new Map([...hosts.entries()].sort(([k1], [k2]) => k1.localeCompare(k2)));

        // const participants: Map<string, number> = new Map<string, number>();
        // for (const row of learnerHourParticipations) {
        //     participants.set(row.participant, (hosts.get(row.participant) ?? 0) + 1);
        // }
        // const sortedParticipants = new Map([...participants.entries()].sort(([k1], [k2]) => k1.localeCompare(k2)));

        // const container = this.client.cv2.getContainerBuilder(null, `Learner Hour Leaderboard - ${description}`);

        // const hostGallery = new MediaGalleryBuilder();
        // const hostBuffer = await this.renderRecordsToPng(sortedHosts);
        // const hostAttachment = new AttachmentBuilder(Buffer.from(hostBuffer, 'utf-8'), { name: 'host.png' });

        // // const assetChannelId = this.client.channelIds.botAssetChannel;
        // // const botAssetChannel = await this.client.channels.fetch(assetChannelId) as TextChannel;

        // // const hostMessage = await botAssetChannel.send({ files: [hostAttachment] });
        // // const hostNewUrl = hostMessage.attachments.first()!.url;

        // hostGallery.addItems(item => item.setURL('attachment://host.png'));
        // // hostGallery.addItems(item => item.setURL(hostNewUrl));
        // container.addMediaGalleryComponents(hostGallery);

        // container.addSeparatorComponents(s => s.setSpacing(SeparatorSpacingSize.Small));

        // const participantGallery = new MediaGalleryBuilder();
        // const participantBuffer = await this.renderRecordsToPng(sortedParticipants);
        // const participantAttachment = new AttachmentBuilder(Buffer.from(participantBuffer, 'utf-8'), { name: 'participant.png' });

        // // const participantMessage = await botAssetChannel.send({ files: [participantAttachment] });
        // // const participantNewUrl = participantMessage.attachments.first()!.url;

        // participantGallery.addItems(item => item.setURL('attachment://participant.png'));
        // // participantGallery.addItems(item => item.setURL(participantNewUrl));
        // container.addMediaGalleryComponents(participantGallery);

        // await interaction.editReply({
        //     files: [hostAttachment, participantAttachment],
        //     components: [container],
        //     flags: MessageFlags.IsComponentsV2
        // });
    }

    private createFieldFromArray = (array: any[]) => {
        const { gem1, gem2, gem3 } = this.client.util.emojis;
        let field = '';
        if (array.length === 0) return 'None';
        array.forEach((item, index) => {
            let prefix: string;
            switch(index){
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

    // private getTable(records: Map<string, number>): string {
    //     let tableHtml = `<table class="my-table"> <thead> <tr><th>User</th><th>Hours hosted</th></tr> </thead> <tbody>`;

    //     for (const record of records) {
    //         tableHtml += `<tr><td>${record[0]}</td><td>${record[1]}</td></tr>\n`;
    //     }

    //     for (let index = 0; index < 50; index++) {
    //         tableHtml += `<tr><td>alex</td><td>is cute</td></tr>\n`;

    //     }

    //     tableHtml += `</tbody></table>`;

    //     return tableHtml;
    // }

    // private getSvg(table: string): string {
    //     const svg = `<?xml version="1.0" encoding="utf-8"?>
    //         <svg xmlns="http://www.w3.org/2000/svg" width="480" height="2400" viewBox="0 0 480 2400">
    //         <style>
    //             /* CSS applied to the foreignObject content */
    //             .container {
    //                 font-family: "Segoe UI", Roboto, Arial, sans-serif;
    //                 font-size: 14px;
    //                 line-height: 1.2;
    //                 color: #222;
    //                 padding: 8px;
    //                 box-sizing: border-box;
    //             }
    //             .my-table {
    //                 border-collapse: collapse;
    //                 width: 100%;
    //             }
    //             .my-table th, .my-table td {
    //                 border: 1px solid #ccc;
    //                 padding: 8px 10px;
    //                 text-align: left;
    //             }
    //             .my-table thead th {
    //                 background: #f0f0f0;
    //                 font-weight: 600;
    //             }
    //         </style>

    //         <!-- optional background -->
    //         <rect width="100%" height="100%" fill="grey"/>

    //         <foreignObject x="0" y="0" width="480" height="2400">
    //             <div xmlns="http://www.w3.org/1999/xhtml" class="container">
    //             ${table}
    //             </div>
    //         </foreignObject>
    //         </svg>`;

    //     return svg;
    // }

    // private async renderRecordsToPng(records: Map<string, number>): Promise<any> {
    //     const content = this.getSvg(this.getTable(records));

    //     const browser = await puppeteer.launch();
    //     const page = await browser.newPage();

    //     await page.setContent(content, { waitUntil: 'networkidle0' });

    //     // Select the table element (or the whole page)
    //     const table = await page.$('table'); // capture only the table
    //     if (!table) throw new Error('Table not found');

    //     // Screenshot as Buffer
    //     const buffer = await table.screenshot({ encoding: 'binary' });

    //     await browser.close();
    //     return buffer;
    // }
}
