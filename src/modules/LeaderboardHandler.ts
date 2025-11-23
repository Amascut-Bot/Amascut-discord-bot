import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ContainerBuilder, ContainerComponent, EmbedBuilder, Interaction, MediaGalleryBuilder, MediaGalleryComponent, MessageFlags, ModalBuilder, ModalSubmitInteraction, SectionBuilder, SeparatorSpacingSize, TextChannel, TextDisplayBuilder, TextDisplayComponent, TextInputBuilder, TextInputStyle, User, UserSelectMenuInteraction } from 'discord.js';
import Bot from '../Bot';
import { EnrageLeaderboard } from '../entity/EnrageLeaderboard';
import { LessThanOrEqual } from 'typeorm';
import ComponentsV2Utils from './ComponentsV2Utils';

export default interface LeaderboardHandler { client: Bot; id: string; interaction: Interaction }

export default class LeaderboardHandler {
    constructor(client: Bot, id: string, interaction: Interaction) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        switch (id) {
            case 'leaderboard_approveEnrage': this.handleLeaderboardApprove(interaction as ButtonInteraction<'cached'>); break;
            case 'leaderboard_rejectEnrage': this.handleLeaderboardReject(interaction as ButtonInteraction<'cached'>); break;
            case 'leaderboard_userselect': this.handleLeaderboardUserselect(interaction as UserSelectMenuInteraction); break;
            case 'leaderboard_createSubmit': this.handleLeaderboardCreateSubmit(interaction as ButtonInteraction<'cached'>); break;
            case 'leaderboard_submit': this.handleLeaderboardSubmit(interaction as ModalSubmitInteraction); break;
        }
    }

    //#region Static

    public static async postLeaderBoard(client: Bot, type: number, channel: TextChannel, timespan: string | null) {
        let dateFrom: Date;
        let dateTo: Date;
        let timestamp: Date = new Date();
        let description: String;

        if (timespan == null){
            timespan = 'currentMonth';
        }

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

        const query = `select
                        user,
                        sum(case when host = 1 then 1 else 0 end) as amount_hosted,
                        sum(case when participate = 1 then 1 else 0 end) as amount_participated
                        from host_participation
                        where type = @type
                        and created_at between '@dateFrom' and '@dateTo'
                        group by user
                        order by amount_hosted desc, amount_participated desc, user asc`
                        .replace('@dateFrom', this.formatDate(dateFrom))
                        .replace('@dateTo', this.formatDate(dateTo))
                        .replace('@type', type.toString());

        const result: { user: string, amount_hosted: number, amount_participated: number}[] = await client.dataSource.query(query);

        const hosts = result.filter(r => r.amount_hosted > 0);
        const participants = result.filter(r => r.amount_participated > 0).sort((a, b) => b.amount_participated - a.amount_participated);

        const hostTypeLabel = type === 0 ? 'Learner Hour' : type === 1 ? 'Lore Book Kill' : type === 2 ? 'Trial' : 'Undefined';

        const embed = new EmbedBuilder()
            .setTimestamp()
            .setTitle(`${hostTypeLabel} Leaderboard (${description})`)
            .setColor(client.color)
            .addFields(this.buildEmbedFields(client, hosts, participants));

        await channel.send({ embeds: [embed] });
    }

    private static formatDate(date: Date): string {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }

    private static chunkArray<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    private static buildEmbedFields(client: Bot, hosts: { user: string, amount_hosted: number, amount_participated: number}[], participants: { user: string, amount_hosted: number, amount_participated: number}[]) {
        const { gem1, gem2, gem3 } = client.util.emojis;
        const chunkSize = 10;
        const hostChunks = this.chunkArray(hosts, chunkSize);
        const participantChunks = this.chunkArray(participants, chunkSize);

        const maxChunks = Math.max(hostChunks.length, participantChunks.length);
        const fields: any[] = [];

        for (let i = 0; i < maxChunks; i++) {
            const hostSlice = hostChunks[i] ?? [];
            const participantSlice = participantChunks[i] ?? [];

            const hostText = hostSlice
                .map((x, idx) => {
                    const pos = i * chunkSize + idx + 1;
                    const label = pos === 1 ? gem1 : pos === 2 ? gem2 : pos === 3 ? gem3 : `${pos}.`;
                    return `${label} <@${x.user}> — ${x.amount_hosted}`;
                }).join("\n");

            const participantText = participantSlice
                .map((x, idx) => {
                    const pos = i * chunkSize + idx + 1;
                    const label = pos === 1 ? gem1 : pos === 2 ? gem2 : pos === 3 ? gem3 : `${pos}.`;
                    return `${label} <@${x.user}> — ${x.amount_participated}`;
                }).join("\n");

            fields.push(
                {
                    name: `Hosts`,// ${i * chunkSize + 1}-${i * chunkSize + hostSlice.length}`,
                    value: hostText || "*No more hosts*",
                    inline: true
                },
                {
                    name: `Participants`,// ${i * chunkSize + 1}-${i * chunkSize + participantSlice.length}`,
                    value: participantText || "*No more participants*",
                    inline: true
                }
            );

            // Add empty spacer row between blocks — except after final block
            if (i < maxChunks - 1) {
                fields.push({
                    name: "\u200B",
                    value: "\u200B",
                    inline: false
                });
            }
        }

        return fields;
    }

    //#endregion

    // following is deprecated

    //#region Moderation

    private async handleLeaderboardReject(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferReply( { flags: MessageFlags.Ephemeral });

        const container = ComponentsV2Utils.cleanContainer(interaction.message.components[0]);

        // Disable Buttons:
        const approveButton = new ButtonBuilder()
            .setCustomId('leaderboard_approveEnrage')
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const rejectButton = new ButtonBuilder()
            .setCustomId('leaderboard_rejectEnrage')
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true);

        (container.components[container.components.length - 4] as ActionRowBuilder<ButtonBuilder>) = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);
        (container.components[container.components.length - 1] as TextDisplayBuilder) = new TextDisplayBuilder().setContent(`*Rejected* by <@${interaction.user.id}>`);

        // Update Panel
        await interaction.message.edit({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { 'parse': [] }
        });

        await interaction.editReply('Enrage Leaderboard Submission successfully rejected');
    }

    private async handleLeaderboardApprove(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferReply( { flags: MessageFlags.Ephemeral });

        const messageComponents = (interaction.message.components[0] as ContainerComponent).components;
        const container = ComponentsV2Utils.cleanContainer(interaction.message.components[0]);

        // Extract Data
        const rawData: string = (messageComponents[0] as TextDisplayComponent).content;
        const enrageRegex = /Submitted Enrage:\s*`(\d+)%`/gim;
        const teamMemberRegex = /RSN:\s*`([^`]+)`\s*\|\s*Discord:\s*<@(\d+)>/gim;
        const unfinishedRsnRegex = /`empty`/gim;

        const enrageMatch = enrageRegex.exec(rawData);
        const teamMemberMatch = rawData.matchAll(teamMemberRegex);
        const unfinishedRsnMatch = unfinishedRsnRegex.exec(rawData);

        if (unfinishedRsnMatch) {
            await interaction.editReply('You need to set all RSN\'s first, use /enrage-edit!');
            return;
        }

        let enrage: number | null = null;
        if (enrageMatch) {
            enrage = parseFloat(enrageMatch[1]);
        }

        if (!enrage || !(enrage > 0)) {
            await interaction.editReply('Something errored while parsing enrage');
            return;
        }

        const team: { rsn: string, disc: string }[] = [];
        if (teamMemberMatch) {
            for (const teamMember of teamMemberMatch) {
                team.push({ rsn: teamMember[1], disc: teamMember[2] });
            }
        }

        if (team.length < 2) {
            await interaction.editReply('Something errored while parsing team-members');
            return;
        }

        const screenshot: string = (messageComponents[2] as MediaGalleryComponent).items[0].media.url;

        const createdAt: Date = new Date(interaction.message.createdTimestamp);

        // Save To DB
        await this.saveLeaderboardApproval(team, screenshot, enrage, createdAt, interaction.user.id);

        // Repost Leaderboard
        const leaderboardChannelId = this.client.channelIds.leaderboards;
        const leaderboardChannel = await interaction.guild!.channels.fetch(leaderboardChannelId) as TextChannel;
        await LeaderboardHandler.postLeaderboard(leaderboardChannel, this.client, interaction.guild!.id);

        // Disable Buttons:
        const approveButton = new ButtonBuilder()
            .setCustomId('leaderboard_approveEnrage')
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const rejectButton = new ButtonBuilder()
            .setCustomId('leaderboard_rejectEnrage')
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true);

        (container.components[container.components.length - 4] as ActionRowBuilder<ButtonBuilder>) = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);
        (container.components[container.components.length - 1] as TextDisplayBuilder) = new TextDisplayBuilder().setContent(`*Approved* by <@${interaction.user.id}>`);

        // Update Panel
        await interaction.message.edit({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { 'parse': [] }
        });

        await interaction.editReply('Enrage-Leaderboard Submission successfully approved');
    }

    //#endregion

    //#region Create / Submit

    private async handleLeaderboardUserselect(interaction: UserSelectMenuInteraction) {
        await interaction.deferUpdate();

        const userIds: string[] = interaction.values;
        const userIdSubmit: string = interaction.user.id;

        if (!userIds.includes(userIdSubmit)) {
            // Add submitting user as well
            userIds.push(userIdSubmit);
        }

        this.client.tempSubmissionData?.set(`leaderboardsubmission_${userIdSubmit}`, userIds);
    }

    private async handleLeaderboardCreateSubmit(interaction: ButtonInteraction<'cached'>) {
        //await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const container = ComponentsV2Utils.cleanContainer(interaction.message.components[0]);

        // Read Message-Information
        const userIdSubmit: string = interaction.user.id;
        const userIds: string[] = this.client.tempSubmissionData?.get(`leaderboardsubmission_${userIdSubmit}`) ?? [];

        if (userIds.length < 2) {
            return await interaction.reply({
                content: 'You need to first select your Group-Members before submitting! Your group must contain at least 2 people!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Build Modal
        const modal = new ModalBuilder()
            .setCustomId(`leaderboard_submit`)
            .setTitle('Create a Enrage-Leaderboard submission');

        const enrageInput = new TextInputBuilder()
            .setCustomId('enrage')
            .setLabel('Which enrage did you achieve?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(6);

        const screenshotInput = new TextInputBuilder()
            .setCustomId('screenshot')
            .setLabel('Please provide a Screenshot showing proof.')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(1000);

        const informationInput = new TextInputBuilder()
            .setCustomId('information')
            .setLabel('Please provide any additional information.')
            .setPlaceholder(`If the Discord-Names of you and your teammates don't align, match them here.`)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(512);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(enrageInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(screenshotInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(informationInput);

        modal.addComponents(firstRow, secondRow, thirdRow);

        // Reset Panel
        await interaction.message.edit({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { 'parse': [] }
        });

        // Open Modal
        await interaction.showModal(modal);
    }

    private async handleLeaderboardSubmit(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const submissionChannelId = this.client.channelIds.leaderboardSubmission;
        const submissionChannel = await interaction.guild!.channels.fetch(submissionChannelId) as TextChannel;

        // Read Message-Information
        const userIdSubmit: string = interaction.user.id;
        const userIds: string[] = this.client.tempSubmissionData?.get(`leaderboardsubmission_${userIdSubmit}`) ?? [];

        const enrage = parseFloat(interaction.fields.getTextInputValue('enrage').replace('%', ''));
        const screenshot = interaction.fields.getTextInputValue('screenshot');
        const information = interaction.fields.getTextInputValue('information');

        // validate values
        if (Number.isNaN(enrage)) {
            return await interaction.editReply(`Your enrage '${interaction.fields.getTextInputValue('enrage')}' is not a valid number!`);
        }

        if (!LeaderboardHandler.isValidUrl(screenshot)) {
            return await interaction.editReply(`Your Screenshot-URL '${screenshot}' is not a valid URL!`);
        }

        LeaderboardHandler.postLeaderboardSubmission(submissionChannel, this.client, interaction.user, [], userIds, enrage, screenshot, information);

        // Reset Userids
        this.client.tempSubmissionData?.set(`leaderboardsubmission_${userIdSubmit}`, []);

        return await interaction.editReply('You Enrage Submission was successfully created. Please wait for an Admin or Owner to review and approve / reject it.')
    }

    //#endregion

    //#region Database

    private async saveLeaderboardApproval(team: { rsn: string, disc: string }[], screenshot: string, enrage: number, createdAt: Date, approvedBy: string): Promise<void> {
        const { dataSource } = this.client;
        const repository = dataSource.getRepository(EnrageLeaderboard);
        const leaderboardObject = new EnrageLeaderboard();

        leaderboardObject.guild = this.interaction.guild!.id;
        leaderboardObject.enrage = enrage;
        leaderboardObject.screenshot = screenshot;
        leaderboardObject.createdAt = createdAt;
        leaderboardObject.approvedAt = new Date();
        leaderboardObject.approvedBy = approvedBy;

        if (team.length >= 1) {
            leaderboardObject.rsn1 = team[0].rsn;
            leaderboardObject.disc1 = team[0].disc;
        }

        if (team.length >= 2) {
            leaderboardObject.rsn2 = team[1].rsn;
            leaderboardObject.disc2 = team[1].disc;
        }

        if (team.length >= 3) {
            leaderboardObject.rsn3 = team[2].rsn;
            leaderboardObject.disc3 = team[2].disc;
        }

        if (team.length >= 4) {
            leaderboardObject.rsn4 = team[3].rsn;
            leaderboardObject.disc4 = team[3].disc;
        }

        if (team.length >= 5) {
            leaderboardObject.rsn5 = team[4].rsn;
            leaderboardObject.disc5 = team[4].disc;
        }

        await repository.save(leaderboardObject);
    }

    //#endregion

    //#region Static

    public static async postLeaderboard(channel: TextChannel, client: Bot, guild: string) {
        const { dataSource } = client;
        const repository = dataSource.getRepository(EnrageLeaderboard);

        // Clear Channel
        const messages = await channel.messages.fetch();
        for await (const [_id, message] of messages) {
            if (!message.pinned) {
                await message.delete();
            }
        }

        const lb1Urls = [
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401380120974987324/lightning1strc.png?ex=68901071&is=688ebef1&hm=2a46f6978cc29f5e79fcb0af05bba5271b6f235cd610110f3d397a1dac387a2e&',
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401379126991913134/rc1stgreen.png?ex=68900f84&is=688ebe04&hm=45bf04530217a9c6231742627333d4762167e640b60b7243f674b8894b906669&',
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401378192287334550/1strc.png?ex=68900ea5&is=688ebd25&hm=be3433533e56424216251a9470b73718bada2ce8f1e88e3b81af955bf8c27849&'
        ];

        const lb2Urls = [
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401380121226641541/lightning2ndrc.png?ex=68901071&is=688ebef1&hm=c65e395a730429e6c7ad6bd0d6a8680b763df194db31b0948a9c5394bfb141a1&',
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401379126744453251/rc2ndghost.png?ex=68900f84&is=688ebe04&hm=576771276a4207a3cf0e5222453951785e9c0c611fac2c2094d3991f2070dfa8&',
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401378192547254334/2ndrc.png?ex=68900ea5&is=688ebd25&hm=1ed43bf85e81c486e266a26b3beb8ad20cc876cdf100d13f18033deb7b9d67dd&'
        ];

        const lb3Urls = [
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401380121474109582/lightning3rdrc.png?ex=68901071&is=688ebef1&hm=14efa72ce79163cbcadd6e8acf407588ac533a1986322362ac27d990220a7331&',
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401379126501445703/rc3rdghost.png?ex=68900f84&is=688ebe04&hm=e385d886c024f0c3c3999c33bd9a206c7b2ffb461648ee728f5e27a46c3c03ff&',
            'https://cdn.discordapp.com/attachments/1399948539894956164/1401378192828141668/3rcrc.png?ex=68900ea5&is=688ebd25&hm=defc56f7abd23b645a5f52c5d2acd548b307f24c7da359e42c821455c69c5b3e&'
        ];

        for (let index = 0; index < 3; index++) {
            const container = new ContainerBuilder().setAccentColor(client.color);

            let entries: EnrageLeaderboard[] = [];

            if (index === 0) {
                // DAY OF RELEASE
                entries = await repository.find({
                    where: {
                        guild: guild,
                        createdAt: LessThanOrEqual(new Date(2025, 7, 4, 23, 59, 59, 999))
                    },
                    order: {
                        enrage: 'DESC',
                        createdAt: 'DESC'
                    },
                    take: 30 // simply for performance to not fetch to much data
                });

                container.addTextDisplayComponents(builder => builder.setContent('# Enrage Leaderboard - Day of Release'));
            } else if (index === 1) {
                // WEEK OF RELEASE
                entries = await repository.find({
                    where: {
                        guild: guild,
                        createdAt: LessThanOrEqual(new Date(2025, 7, 10, 23, 59, 59, 999))
                    },
                    order: {
                        enrage: 'DESC',
                        createdAt: 'DESC'
                    },
                    take: 30 // simply for performance to not fetch to much data
                });

                container.addTextDisplayComponents(builder => builder.setContent('# Enrage Leaderboard - Week of Release'));
            } else if (index === 2) {
                // ALL TIME
                entries = await repository.find({
                    where: {
                        guild: guild,
                    },
                    order: {
                        enrage: 'DESC',
                        createdAt: 'DESC'
                    },
                    take: 30 // simply for performance to not fetch to much data
                });

                container.addTextDisplayComponents(builder => builder.setContent('# Enrage Leaderboard - All Time'));
            }

            // Clean up entries by people of the same team, only take their first / highest entry
            const uniqueCombinations = new Map<string, EnrageLeaderboard>();

            for (const entry of entries) {
                const users = [entry.disc1, entry.disc2, entry.disc3, entry.disc4, entry.disc5];
                const sorted = users.slice().sort(); // sort to ignore order
                const key = sorted.join('-');        // create a unique key

                if (!uniqueCombinations.has(key)) {
                    uniqueCombinations.set(key, entry);
                }
            }

            entries = Array.from(uniqueCombinations.values());

            // LB 1:
            if (entries.length > 0) {
                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
                container.addSectionComponents(await this.getLeaderboardSection(entries[0], lb1Urls[index]));
            }

            // LB 2:
            if (entries.length > 1) {
                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
                container.addSectionComponents(await this.getLeaderboardSection(entries[1], lb2Urls[index]));
            }

            // LB 3:
            if (entries.length > 2) {
                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
                container.addSectionComponents(await this.getLeaderboardSection(entries[2], lb3Urls[index]));
            }

            if (entries.length === 0) {
                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
                container.addTextDisplayComponents(builder => builder.setContent('# No Leaderboard entries available!'));
            }

            // Post New Leaderboard
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { 'parse': [] }
            });
        }
    }

    private static async getLeaderboardSection(entry: EnrageLeaderboard, thumbnailUrl: string): Promise<SectionBuilder> {
        const result = new SectionBuilder();

        let text: string = `Max Enrage: ${entry.enrage}%\nTeam:\n`;

        if (entry.rsn1 && entry.disc1) {
            text += `1: \`${entry.rsn1}\` <@${entry.disc1}>\n`;
        }

        if (entry.rsn2 && entry.disc2) {
            text += `2: \`${entry.rsn2}\` <@${entry.disc2}>\n`;
        }

        if (entry.rsn3 && entry.disc3) {
            text += `3: \`${entry.rsn3}\` <@${entry.disc3}>\n`;
        }

        if (entry.rsn4 && entry.disc4) {
            text += `4: \`${entry.rsn4}\` <@${entry.disc4}>\n`;
        }

        if (entry.rsn5 && entry.disc5) {
            text += `5: \`${entry.rsn5}\` <@${entry.disc5}>\n`;
        }

        result.addTextDisplayComponents(builder => builder.setContent(text));
        result.setThumbnailAccessory(builder => builder.setURL(thumbnailUrl));

        return result;
    }

    public static async postLeaderboardSubmission(channel: TextChannel, client: Bot, user: User, teamRSN: string[], teamDisc: string[], enrage: number, screenshot: string, information: string) {

        const adminMention = client.roleIds.admin;
        const ownerMention = client.roleIds.owner;

        const container = new ContainerBuilder().setAccentColor(client.color);

        let text: string = `> New Enrage-Leaderboard submission from: <@${user.id}>\n`;
        text += `Submitted Enrage: \`${enrage}%\`\n`;
        text += `Team Members:\n`;

        teamDisc.forEach((teamMember: string, index: number) => {
            text += `${index + 1}: RSN: \`${teamRSN.length >= index + 1 ? teamRSN[index] : 'empty'}\` | Discord: <@${teamMember}>\n`;
        });
        container.addTextDisplayComponents(textBuilder => textBuilder.setContent(text));

        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems({
            description: "Submitted Screenshot",
            media: { url: screenshot }
        }));

        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
        container.addTextDisplayComponents(textBuilder => textBuilder.setContent('Additional Information:\n' + information));

        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
        container.addTextDisplayComponents(textBuilder => textBuilder.setContent('Moderation Controls:'));

        const approveButton = new ButtonBuilder()
            .setCustomId('leaderboard_approveEnrage')
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId('leaderboard_rejectEnrage')
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger);

        container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton))

        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
        container.addTextDisplayComponents(textBuilder => textBuilder.setContent('Moderation Status:'));
        container.addTextDisplayComponents(textBuilder => textBuilder.setContent('*Open*'));

        await channel.send( {
            content: `${adminMention}, ${ownerMention}`
        });

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { "parse": [] }
        });
    }

    private static isValidUrl(string: string): boolean {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    //#endregion
}
