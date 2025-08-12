
import Bot from '../Bot';
import { getChannels } from '../GuildSpecifics';
import { DiscordAPIError, VoiceState, ChannelType, PermissionFlagsBits, GuildMember, ButtonInteraction, MessageFlags, Channel, ContainerBuilder, SeparatorSpacingSize, ButtonBuilder, ButtonStyle, GuildChannel, VoiceChannel, User, OverwriteType } from 'discord.js';

export default interface TempChannelManager {
    client: Bot;
    built: boolean;
}

export default class TempChannelManager {
    public client: Bot;
    public built: boolean;
    private tempChannelIds: Set<string>;

    constructor(client: Bot) {
        this.client = client;
        this.built = false;
        this.tempChannelIds = new Set();

        this.setupVoiceStateListener();
        this.loadTempChannelIds();
        this.loaded();
    }

    private async loadTempChannelIds(): Promise<void> {
        const channels = getChannels(process.env.GUILD_ID);
        const excludedChannels = [channels.tempVCCreate, channels.afkVC]; // join to create and afk

        try {
            const primaryCategory = await this.client.channels.fetch(channels.tempVCCategory);
            const secondaryCategory = await this.client.channels.fetch(channels.tempVCCategory2);
            const tertiaryCategory = await this.client.channels.fetch(channels.tempVCCategory3);

            if (primaryCategory && primaryCategory.type === ChannelType.GuildCategory) {
                const primaryVcs = await primaryCategory.children.cache.filter(c => c.type === ChannelType.GuildVoice && !excludedChannels.includes(c.id));

                for (const [key, vc] of primaryVcs) {
                    this.tempChannelIds.add(vc.id);
                }
            }

            if (secondaryCategory && secondaryCategory.type === ChannelType.GuildCategory) {
                const primaryVcs = await secondaryCategory.children.cache.filter(c => c.type === ChannelType.GuildVoice && !excludedChannels.includes(c.id));

                for (const [key, vc] of primaryVcs) {
                    this.tempChannelIds.add(vc.id);
                }
            }

            if (tertiaryCategory && tertiaryCategory.type === ChannelType.GuildCategory) {
                const primaryVcs = await tertiaryCategory.children.cache.filter(c => c.type === ChannelType.GuildVoice && !excludedChannels.includes(c.id));

                for (const [key, vc] of primaryVcs) {
                    this.tempChannelIds.add(vc.id);
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
            const channels = getChannels(process.env.GUILD_ID);

            // User joins the "create" channel
            if (newState.channelId === channels.tempVCCreate && newState.member) {
                await this.handleTempVCCreation(newState);
            }

            // User leaves a voice channel
            if (oldState.channel && oldState.channelId !== channels.tempVCCreate) {
                this.handleTempVCDeletion(oldState);
            }
        });
    }

    private async handleTempVCCreation(voiceState: VoiceState): Promise<void> {
        const member = voiceState.member as GuildMember;
        const guild = voiceState.guild;

        if (!member || !guild) return;

        try {
            // Create a new temp VC
            const newChannel = await this.createTempVCWithFallback(member);
            if (newChannel) {
                await member.voice.setChannel(newChannel);
                this.tempChannelIds.add(newChannel.id);

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

    private async createTempVCWithFallback(member: GuildMember): Promise<any> {
        const channels = getChannels(process.env.GUILD_ID);
        const guild = member.guild;

        const existingTempChannels = guild.channels.cache.filter(c => this.tempChannelIds.has(c.id));
        let channelCount = 0;

        // getting the highest channel Team-Name number, this should fix channels beeing named with the same number over and over again
        existingTempChannels.forEach(c => {
            const match = /Team #(\d+)/g.exec(c.name);

            if (match && channelCount < parseFloat(match[1])) {
                channelCount = parseFloat(match[1]);
            }
        });

        channelCount++;

        const channelName = `Team #${channelCount} | ${member.displayName}`;

        try {
            const primaryCategory = await this.client.channels.fetch(channels.tempVCCategory);
            if (primaryCategory && primaryCategory.type === ChannelType.GuildCategory && primaryCategory.children.cache.size < 50) {
                return await this.createTempChannel(guild, channelName, channels.tempVCCategory, member, 'primary');
            }

            const secondaryCategory = await this.client.channels.fetch(channels.tempVCCategory2);
            if (secondaryCategory && secondaryCategory.type === ChannelType.GuildCategory && secondaryCategory.children.cache.size < 50) {
                return await this.createTempChannel(guild, channelName, channels.tempVCCategory2, member, 'secondary');
            }

            const tertiaryCategory = await this.client.channels.fetch(channels.tempVCCategory3);
            if (tertiaryCategory && tertiaryCategory.type === ChannelType.GuildCategory && tertiaryCategory.children.cache.size < 50) {
                return await this.createTempChannel(guild, channelName, channels.tempVCCategory3, member, 'tertiary');
            }

            this.client.logger.error({
                handler: this.constructor.name,
                message: `Both temp VC categories are full! Cannot create channel for ${member.user.tag}`,
                error: new Error('Both temp VC categories are full!')
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

    private async createTempChannel(guild: any, channelName: string, categoryId: string, member: GuildMember, categoryType: string): Promise<any> {
        try {
            const channel = await guild.channels.create({
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
            return channel;

        } catch (error) {
            if (error instanceof DiscordAPIError && error.code === 50035) { // Max number of channels in category
                 this.client.logger.error({
                    handler: this.constructor.name,
                    message: `Category ${categoryType} is full when trying to create channel for ${member.user.tag}`,
                    error: error
                });
            }
            throw error;
        }
    }

    private async handleTempVCDeletion(oldState: VoiceState): Promise<void> {
        const channel = oldState.channel;

        if (channel && this.tempChannelIds.has(channel.id) && channel.members.size === 0) {
            try {
                await channel.delete('Temp VC auto-cleanup: empty channel');
                this.tempChannelIds.delete(channel.id);
                this.client.logger.log({
                    handler: this.constructor.name,
                    message: `Auto-deleted empty temp VC: ${channel.name}`
                }, true);
            } catch (error) {
                // Channel might have been deleted already
                if (error instanceof DiscordAPIError && error.code === 10003) {
                    this.tempChannelIds.delete(channel.id);
                } else {
                    this.client.logger.error({
                        handler: this.constructor.name,
                        message: `Failed to delete temp VC: ${channel.name}`,
                        error: error as Error
                    });
                }
            }
        } else {
            // check if user that left was the vc owner
            const owner = await this.getTempVcOwner(channel as VoiceChannel);

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

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
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

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
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
