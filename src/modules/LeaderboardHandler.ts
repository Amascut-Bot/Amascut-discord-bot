import { ActionRowBuilder, ActionRowComponent, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ContainerBuilder, ContainerComponent, EmbedBuilder, Interaction, MediaGalleryComponent, MessageFlags, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, SectionBuilder, SeparatorSpacingSize, TextChannel, TextDisplayBuilder, TextDisplayComponent, TextInputBuilder, TextInputStyle } from 'discord.js';
import Bot from '../Bot';
import axios from 'axios';
import TranscriptGenerator from './TranscriptGenerator';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Ticket } from '../entity/Ticket';
import { getRoles, getChannels } from '../GuildSpecifics';
import { EnrageLeaderboard } from '../entity/EnrageLeaderboard';
import { secureHeapUsed } from 'crypto';
import { LessThanOrEqual } from 'typeorm';
import { release } from 'os';

const ticketTranscriptChannelId = getChannels(process.env.GUILD_ID).TICKET_TRANSCRIPT_CHANNEL;

export default interface LeaderboardHandler { client: Bot; id: string; interaction: Interaction }

export default class LeaderboardHandler {
    constructor(client: Bot, id: string, interaction: ButtonInteraction<'cached'>) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        switch (id) {
            case 'leaderboard_approveEnrage': this.handleLeaderboardApprove(interaction); break;
            case 'leaderboard_rejectEnrage': this.handleLeaderboardReject(interaction); break;
        }
    }

    private async handleLeaderboardReject(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferReply( { flags: MessageFlags.Ephemeral });

        const { cleanContainer } = this.client.util;
        const cleanUp = cleanContainer.bind(this.client.util)

        const container = cleanUp(interaction.message.components[0]);

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

        (container.components[5] as ActionRowBuilder<ButtonBuilder>) = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);
        (container.components[8] as TextDisplayBuilder) = new TextDisplayBuilder().setContent(`*Rejected* by <@${interaction.user.id}>`);

        // Update Panel
        await interaction.message.edit({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { 'parse': [] }
        });

        await interaction.editReply('Enrage-Leaderboard Submission successfully rejected');
    }

    private async handleLeaderboardApprove(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferReply( { flags: MessageFlags.Ephemeral });

        const { cleanContainer } = this.client.util;
        const cleanUp = cleanContainer.bind(this.client.util)

        const messageComponents = (interaction.message.components[0] as ContainerComponent).components;
        const container = cleanUp(interaction.message.components[0]);

        // Extract Data
        const rawData: string = (messageComponents[0] as TextDisplayComponent).content;
        const enrageRegex = /Submitted Enrage:\s*`(\d+)%`/gim;
        const teamMemberRegex = /RSN:\s*`([^`]+)`\s*\|\s*Disc:\s*<@(\d+)>/gim;

        const enrageMatch = enrageRegex.exec(rawData);
        const teamMemberMatch = rawData.matchAll(teamMemberRegex);

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

        // Save To Db
        await this.saveLeaderboardApproval(team, screenshot, enrage, createdAt, interaction.user.id);

        // Repost Leaderboard
        const leaderboardChannelId = getChannels(interaction.guild!.id).leaderboards;
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

        (container.components[5] as ActionRowBuilder<ButtonBuilder>) = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);
        (container.components[8] as TextDisplayBuilder) = new TextDisplayBuilder().setContent(`*Approved* by <@${interaction.user.id}>`);

        // Update Panel
        await interaction.message.edit({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { 'parse': [] }
        });

        await interaction.editReply('Enrage-Leaderboard Submission successfully approved');
    }

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

    public static async postLeaderboard(channel: TextChannel, client: Bot, guild: string) {
        const { dataSource } = client;
        const repository = dataSource.getRepository(EnrageLeaderboard);

        // Clear Channel
        const messages = await channel.messages.fetch();
        for await (const [_id, message] of messages) {
            await message.delete();
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
                container.addTextDisplayComponents(builder => builder.setContent('# No Leaderboard entries for available!'));
            }

            container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
            container.addTextDisplayComponents(builder => builder.setContent('-# Use `/enrage-submit` to submit your team for the leaderboard!'));

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
}
