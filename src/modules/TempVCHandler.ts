
import Bot from '../Bot';
import { DiscordAPIError, VoiceState, ChannelType, PermissionFlagsBits, GuildMember, ButtonInteraction, MessageFlags, ContainerBuilder, SeparatorSpacingSize, ButtonBuilder, ButtonStyle, VoiceChannel, OverwriteType, ContainerComponent, TextDisplayComponent, Guild } from 'discord.js';

export default interface TempChannelManager {
    client: Bot;
    built: boolean;
}

export default class TempChannelManager {
    public client: Bot;
    public built: boolean;
    private tempChannelIds: Set<string>;
    private learnerTempChannelIds: Set<string>;

    constructor(client: Bot) {
        this.client = client;
        this.built = false;
        this.tempChannelIds = new Set();
        this.learnerTempChannelIds = new Set();

        this.setupVoiceStateListener();
        this.loadTempChannelIds();
        this.loaded();
    }

    private async loadTempChannelIds(): Promise<void> {
        const channels = this.client.channelIds;
        const excludedChannels = [channels.tempVCCreate, channels.afkVC, channels.learnerWaiting, channels.learnerTempVCCreate, channels.learnerTeaching]; // join to create and afk, learner join to create, waiting room, drop in room

        try {
            const primaryCategory = await this.client.channels.fetch(channels.tempVCCategory);
            const secondaryCategory = await this.client.channels.fetch(channels.tempVCCategory2);
            const tertiaryCategory = await this.client.channels.fetch(channels.tempVCCategory3);
            const learnerCategory = await this.client.channels.fetch(channels.learnerCategory);

            if (primaryCategory && primaryCategory.type === ChannelType.GuildCategory) {
                const primaryVcs = await primaryCategory.children.cache.filter(c => c.type === ChannelType.GuildVoice && !excludedChannels.includes(c.id));

                for (const [_, vc] of primaryVcs) {
                    this.tempChannelIds.add(vc.id);
                }
            }

            if (secondaryCategory && secondaryCategory.type === ChannelType.GuildCategory) {
                const secondaryVcs = await secondaryCategory.children.cache.filter(c => c.type === ChannelType.GuildVoice && !excludedChannels.includes(c.id));

                for (const [_, vc] of secondaryVcs) {
                    this.tempChannelIds.add(vc.id);
                }
            }

            if (tertiaryCategory && tertiaryCategory.type === ChannelType.GuildCategory) {
                const tertiaryVcs = await tertiaryCategory.children.cache.filter(c => c.type === ChannelType.GuildVoice && !excludedChannels.includes(c.id));

                for (const [_, vc] of tertiaryVcs) {
                    this.tempChannelIds.add(vc.id);
                }
            }

            if (learnerCategory && learnerCategory.type === ChannelType.GuildCategory) {
                const learnerVcs = await learnerCategory.children.cache.filter(c => c.type === ChannelType.GuildVoice && !excludedChannels.includes(c.id));

                for (const [_, vc] of learnerVcs) {
                    this.learnerTempChannelIds.add(vc.id);
                }
            }
        } catch (error) {
            this.client.logger.error({
                handler: this.constructor.name,
                message: `Failed to init temp vc channels`,
                error: error as Error
            });
        }
    }

    private setupVoiceStateListener(): void {
        this.client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
            const channels = this.client.channelIds;

            // User joins the "create" channel
            if ((newState.channelId === channels.tempVCCreate || newState.channelId === channels.learnerTempVCCreate) && newState.member) {
                await this.handleTempVCCreation(newState);
            }

            // User leaves a voice channel
            if (oldState.channel && oldState.channelId !== channels.tempVCCreate && oldState.channelId !== channels.learnerTempVCCreate) {
                this.handleTempVCDeletion(oldState);
            }
        });
    }

    private async handleTempVCCreation(voiceState: VoiceState): Promise<void> {
        const channels = this.client.channelIds;
        const member = voiceState.member as GuildMember;
        const guild = voiceState.guild;
        const category = voiceState.channelId === channels.tempVCCreate ? 'main' : voiceState.channelId === channels.learnerTempVCCreate ? 'learner' : '';

        if (!member || !guild) return;

        try {
            // Create a new temp VC
            const newChannel = await this.createTempVCWithFallback(member, category);

            if (newChannel) {
                try {
                    await member.voice.setChannel(newChannel);
                } catch (error) {
                    if (error instanceof DiscordAPIError && error.code === 40032) {	//Target user is not connected to voice
                        //if user left vc to quickly, before you could have moved to their created vc, delete the created vc so it doesn't stick around
                        if (newChannel) {
                            await newChannel.delete();
                            return;
                        }
                    }
                    throw error;
                }

                if (category === 'main') {
                    this.tempChannelIds.add(newChannel.id);
                } else if (category === 'learner') {
                    this.learnerTempChannelIds.add(newChannel.id);
                }

                await this.postTempVcDashboard(newChannel);
            }
        } catch (error) {
            this.client.logger.error({
                handler: this.constructor.name,
                message: `Failed to handle temp VC creation for ${member.user.tag}`,
                error: error as Error
            });
        }
    }

    private async createTempVCWithFallback(member: GuildMember, category: string): Promise<any> {
        const channels = this.client.channelIds;
        const guild = member.guild;

        try {
            if (category === 'main') {
                const primaryCategory = await this.client.channels.fetch(channels.tempVCCategory);
                if (primaryCategory && primaryCategory.type === ChannelType.GuildCategory && primaryCategory.children.cache.size < 50) {
                    return await this.createTempChannel(guild, channels.tempVCCategory, member, 'primary');
                }

                const secondaryCategory = await this.client.channels.fetch(channels.tempVCCategory2);
                if (secondaryCategory && secondaryCategory.type === ChannelType.GuildCategory && secondaryCategory.children.cache.size < 50) {
                    return await this.createTempChannel(guild, channels.tempVCCategory2, member, 'secondary');
                }

                const tertiaryCategory = await this.client.channels.fetch(channels.tempVCCategory3);
                if (tertiaryCategory && tertiaryCategory.type === ChannelType.GuildCategory && tertiaryCategory.children.cache.size < 50) {
                    return await this.createTempChannel(guild, channels.tempVCCategory3, member, 'tertiary');
                }
            } else if (category === 'learner') {
                const learnerCategory = await this.client.channels.fetch(channels.learnerCategory);
                if (learnerCategory && learnerCategory.type === ChannelType.GuildCategory && learnerCategory.children.cache.size < 50) {
                    return await this.createTempChannel(guild, channels.learnerCategory, member, 'learner');
                }
            }


            this.client.logger.error({
                handler: this.constructor.name,
                message: `All temp VC categories are full! Cannot create channel for ${member.user.tag}`,
                error: new Error('All temp VC categories are full!')
            });
            return null;

        } catch (error) {
            this.client.logger.error({
                handler: this.constructor.name,
                message: `Error creating temp VC for ${member.user.tag}`,
                error: error as Error
            });
            return null;
        }
    }

    private async createTempChannel(guild: Guild, categoryId: string, member: GuildMember, categoryType: string): Promise<any> {
        const existingTempChannels = categoryType === 'learner' ? guild.channels.cache.filter(c => this.learnerTempChannelIds.has(c.id)) : guild.channels.cache.filter(c => this.tempChannelIds.has(c.id));
        let channelCount = 0;

        // getting the highest channel Team-Name number, this should fix channels beeing named with the same number over and over again
        existingTempChannels.forEach(c => {
            const match = /#(\d+)/g.exec(c.name);

            if (match && channelCount < parseFloat(match[1])) {
                channelCount = parseFloat(match[1]);
            }
        });

        let INVALID_COMMUNITY_PROPERTY_NAME = false;
        const MAX_TRIES = 100;
        let TRIES = 0;

        do {
            try {
                channelCount++;
                const channelName = categoryType === 'learner' ? `Teaching #${channelCount}`
                    : INVALID_COMMUNITY_PROPERTY_NAME && TRIES === 1 ? `Team #${channelCount} | ${member.displayName}`
                    : INVALID_COMMUNITY_PROPERTY_NAME ? `Team #${channelCount}` : `Team #${channelCount} | ${member.displayName}`;

                const channel: VoiceChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildVoice,
                    parent: categoryId,
                    bitrate: 64000,
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [
                                PermissionFlagsBits.Connect,
                                PermissionFlagsBits.Speak,
                                PermissionFlagsBits.Stream,
                                PermissionFlagsBits.UseVAD,
                                PermissionFlagsBits.ManageChannels
                            ]
                        }
                    ]
                });
                this.client.logger.log({
                    handler: this.constructor.name,
                    message: `Created temp VC "${channelName}" in ${categoryType} category for ${member.user.tag}`
                }, true);

                const tempVCCreate = categoryType === 'learner' ? await guild.channels.fetch(this.client.channelIds.learnerTempVCCreate) as VoiceChannel
                    : await guild.channels.fetch(this.client.channelIds.tempVCCreate) as VoiceChannel;
                const overwrites = tempVCCreate.permissionOverwrites.cache.map(overwrite => ({
                    id: overwrite.id,
                    allow: overwrite.allow.bitfield,
                    deny: overwrite.deny.bitfield,
                    type: overwrite.type
                })).concat(channel.permissionOverwrites.cache.map(overwrite => ({
                    id: overwrite.id,
                    allow: overwrite.allow.bitfield,
                    deny: overwrite.deny.bitfield,
                    type: overwrite.type
                })));

                await channel.permissionOverwrites.set(overwrites);

                // allow everyone to join in learner channels, because create channel is hidden for everyone
                if (categoryType === 'learner') {
                    await channel.permissionOverwrites.edit(
                        channel.guild.roles.everyone,
                        {
                            ViewChannel: null
                        }
                    )
                }

                return channel;
            } catch (error) {
                if (error instanceof DiscordAPIError && error.code === 50035 && error.message.includes('CHANNEL_PARENT_MAX_CHANNELS')) { // Max number of channels in category
                    this.client.logger.error({
                        handler: this.constructor.name,
                        message: `Category ${categoryType} is full when trying to create channel for ${member.user.tag}`,
                        error: error
                    });
                    throw error;
                } else if (error instanceof DiscordAPIError && error.code === 50035 && error.message.includes('INVALID_COMMUNITY_PROPERTY_NAME')) { // ?!?!?!?!?!??!?!?!
                    INVALID_COMMUNITY_PROPERTY_NAME = true;
                    TRIES++;
                } else {
                    throw error;
                }
            }
        }
        while (TRIES < MAX_TRIES)
    }

    private async handleTempVCDeletion(oldState: VoiceState): Promise<void> {
        const channel = oldState.channel;

        if (channel && (this.tempChannelIds.has(channel.id) || this.learnerTempChannelIds.has(channel.id)) && channel.members.size === 0) {
            try {
                await channel.delete('Temp VC auto-cleanup: empty channel');

                if (this.tempChannelIds.has(channel.id)) {
                    this.tempChannelIds.delete(channel.id);
                }

                if (this.learnerTempChannelIds.has(channel.id)) {
                    this.learnerTempChannelIds.delete(channel.id);
                }

                this.client.logger.log({
                    handler: this.constructor.name,
                    message: `Auto-deleted empty temp VC: ${channel.name}`
                }, true);
            } catch (error) {
                // Channel might have been deleted already
                if (error instanceof DiscordAPIError && error.code === 10003) {
                    if (this.tempChannelIds.has(channel.id)) {
                        this.tempChannelIds.delete(channel.id);
                    }

                    if (this.learnerTempChannelIds.has(channel.id)) {
                        this.learnerTempChannelIds.delete(channel.id);
                    }
                } else {
                    this.client.logger.error({
                        handler: this.constructor.name,
                        message: `Failed to delete temp VC: ${channel.name}`,
                        error: error as Error
                    });
                }
            }
        } else {
            //only in main temp VC's and only if channel still is there
            if (!this.tempChannelIds.has(channel?.id ?? '')) {
                return;
            }

            // check if vc owner is still present
            const owner = await this.getTempVcOwner(channel as VoiceChannel);

            // also check if claim button is already there
            try {
                const messages = (await channel?.messages.fetch())?.filter(msg => msg.author.id === this.client.user?.id);

                if (messages && messages.size > 0) {
                    for (const [_, message] of messages) {
                        if (message.components.length > 0) {
                            const msgComponents = (message.components[0] as ContainerComponent).components;

                            if ((msgComponents[0] as TextDisplayComponent).content === 'Owner has left, you can claim this VC to use the Dashboard!') {
                                return;
                            }
                        }
                    }
                }
            } catch (error) {
                if (error instanceof DiscordAPIError && error.code === 10003) {
                    // channel doesn't exist anymore, ignore
                    return;
                }
                throw error;
            }

            if (owner?.voice.channelId !== channel?.id) {
                await this.postTempVcClaimButton(channel as VoiceChannel);
            }
        }
    }

    public __initParentListener(channelId: string): void {
        this.client.logger.log({
            handler: this.constructor.name,
            message: `Temp VC create channel ${channelId} configured with custom fallback system`
        }, true);
    }

    public loaded(): void {
        this.built = true;
        this.client.logger.log({ handler: this.constructor.name, message: 'Loaded handler for TempVC' }, true);
    }

    //#region VC Dashboard

    public async handleTempVcDashboardInteraction(interaction: ButtonInteraction<'cached'>): Promise<void> {
        switch (interaction.customId) {
            case 'tempvc_setLimit': this.setTempVCUserLimit(interaction, 5); break;
            case 'tempvc_resetLimit': this.setTempVCUserLimit(interaction, 0); break;
            case 'tempvc_claim': this.claimTempVC(interaction); break;
        }
    }

    private async postTempVcDashboard(channel: VoiceChannel) {
        const container = new ContainerBuilder()
            .setAccentColor(this.client.color)
            .addTextDisplayComponents(builder => builder.setContent('## Temp VC Control Panel'))
            .addSeparatorComponents(builder => builder.setSpacing(SeparatorSpacingSize.Large))
            .addTextDisplayComponents(builder => builder.setContent('You can always edit this channel manually by clicking the ⚙️ in your Voice Channel!'))
            .addSeparatorComponents(builder => builder.setSpacing(SeparatorSpacingSize.Large));

        const setLimitButton = new ButtonBuilder()
            .setCustomId('tempvc_setLimit')
            .setLabel('Set Limit to 5')
            .setStyle(ButtonStyle.Success);

        const resetLimitButton = new ButtonBuilder()
            .setCustomId('tempvc_resetLimit')
            .setLabel('Reset Limit')
            .setStyle(ButtonStyle.Danger);

        container.addActionRowComponents(builder => builder.addComponents(setLimitButton, resetLimitButton));

        try {
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            // do nothing, if this fails all users have left the vc to quickly so it is already deleted
        }
    }

    private async postTempVcClaimButton(channel: VoiceChannel) {
        const container = new ContainerBuilder()
            .setAccentColor(this.client.color)
            .addTextDisplayComponents(builder => builder.setContent('Owner has left, you can claim this VC to use the Dashboard!'))

        const claimButton = new ButtonBuilder()
            .setCustomId('tempvc_claim')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Primary);

        container.addActionRowComponents(builder => builder.addComponents(claimButton));

        try {
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            // do nothing, if this fails all users have left the vc to quickly so it is already deleted
        }
    }

    private async getTempVcOwner(channel: VoiceChannel) : Promise<GuildMember | undefined> {
        const overwrites = channel.permissionOverwrites.cache;
        const userOverwrites = overwrites.filter(overwrite => overwrite.type === OverwriteType.Member && overwrite.allow.has('ManageChannels'));

        const owners = userOverwrites.map(async overwrite => await channel.guild.members.fetch(overwrite.id));

        if (owners.length > 0) {
            return owners[0];
        }

        return undefined;
    }

    private async setTempVCUserLimit(interaction: ButtonInteraction<'cached'>, limit: number): Promise<void> {
        if (interaction.channel?.type === ChannelType.GuildVoice) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            //const isTempVCOwner = interaction.channel.permissionsFor(interaction.user)?.has('ManageChannels');
            const tempVCOwner = await this.getTempVcOwner(interaction.channel);
            const isTempVCOwner = tempVCOwner && tempVCOwner.id === interaction.user.id;

            if (isTempVCOwner) {
                if (limit === 0) {
                    await interaction.channel.setUserLimit(0);
                    await interaction.editReply('Successfully reset User Limit!');
                    return;
                }
                else if (limit === 5) {
                    await interaction.channel.setUserLimit(5);
                    await interaction.editReply('Successfully set User Limit to 5 Users!');
                    return;
                }
            } else {
                await interaction.editReply('You are not the owner of this Voice Channel!');
                return;
            }
        }
    }

    private async claimTempVC(interaction: ButtonInteraction<'cached'>) : Promise<void> {
        if (interaction.channel?.type === ChannelType.GuildVoice) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const tempVCOwner = await this.getTempVcOwner(interaction.channel);

            if (tempVCOwner) {
                // check if original owner is still connected / reconnected
                if (tempVCOwner.voice.channelId === interaction.channelId) {
                    await interaction.editReply('Owner is still connected!');
                    await interaction.message.delete();
                } else {
                    // check if user is actually in this vc
                    if (interaction.member.voice.channelId === interaction.channel.id) {
                        //remove old owner and set new one
                        await interaction.channel.permissionOverwrites.delete(tempVCOwner);
                        await interaction.channel.permissionOverwrites.create(interaction.member, {
                            Connect: true,
                            Speak: true,
                            Stream: true,
                            UseVAD: true,
                            ManageChannels: true
                        });

                        const match = /Team #(\d+)/g.exec(interaction.channel.name);

                        if (match) {
                            await interaction.channel.setName(
                                interaction.channel.name.replace(/^Team #(\d+) \| .+$/, `Team #$1 | ${interaction.member.displayName}`)
                            );
                        }

                        await interaction.editReply('Successfully claimed TempVC!');
                        await interaction.message.delete();
                    } else {
                        await interaction.editReply('You are not in this Voice Channel!');
                    }
                }
            } else {
                await interaction.editReply(`Can't find previous owner to check, if they are still connected!`);
                this.client.logger.log({ handler: this.constructor.name, message: `Failed to TempVC Owner of Channel ${interaction.channel.id}` }, true);
            }
        }
    }

    //#endregion
}
