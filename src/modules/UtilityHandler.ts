import { EmbedBuilder, ChatInputCommandInteraction, Interaction, AttachmentBuilder, TextChannel, ContainerBuilder, SeparatorSpacingSize, GuildMember, Message } from 'discord.js';
import Bot from '../Bot';
import * as config from '../../config.json';
import { Override } from '../entity/Override';
import axios from 'axios';
import { Timeout } from '../entity/Timeout';

export default interface UtilityHandler {
    client: Bot;
    config: typeof config;
    random(array: Array<any>): Array<number>;
    loadingEmbed: EmbedBuilder;
    loadingText: string;
    imageUrlCache: Map<string, string>;
    reuploadImage(url: string): Promise<string>;
}

interface Emojis {
    [emojiName: string]: string;
}

interface Categories {
    killCount: string[]
    collectionLog: string[]
    serverPings: string[]
    vanity: string[]
    enrage: string[]
}

interface Hierarchy {
    [key: string]: string[];
}

export default class UtilityHandler {
    constructor(client: Bot) {
        this.client = client;
        this.config = config;
        this.random = (array) => array[Math.floor(Math.random() * array.length)];
        this.deleteMessage = this.deleteMessage;
        this.loadingEmbed = new EmbedBuilder().setAuthor({ name: 'Loading...' });
        this.loadingText = '<a:Typing:598682375303593985> **Loading...**';
        this.imageUrlCache = new Map<string, string>();
    }

    get ignoredChannels(): string[] {
        return ['1387800391449579610', '1387800453303144478'];
    }

    get colours() {
        const configColours = this.config.colours;
        return {
            ...configColours,
            discord: configColours
        };
    }

    get emojis(): Emojis {
        return {
            gem1: '<:gem1:1057231061375008799>',
            gem2: '<:gem2:1057231076239605770>',
            gem3: '<:gem3:1057231089854324736>',
        }
    }

    get categories(): Categories {
        return {
            killCount: ['catBoundInitiate', 'scarabMarkedDisciple', 'whispererOfTheWanderer', 'bearerOfTheUnholySigil', 'fangOfTheDevourer'],
            collectionLog: ['visionmaker', 'tumekenMask', 'tumekenRobeTop', 'tumekenRobeBottom', 'tumekenGloves', 'tumekenBoots', 'devourersGuard', 'tumekensLight', 'amaskitty'],
            serverPings: ['serverAnnouncements', 'goodMorning'],
            vanity: ['silverSpoon', 'goldenSpoon'],
            enrage: ['enr500', 'enr1000', 'enr2000', 'enr4000', 'rd500', 'rd1000', 'rd2000', 'rd4000', 'rw500', 'rw1000', 'rw2000', 'rw4000']
        }
    }

    get hierarchy(): Hierarchy {
        return {
            killCount: ['catBoundInitiate', 'scarabMarkedDisciple', 'whispererOfTheWanderer', 'bearerOfTheUnholySigil', 'fangOfTheDevourer']
        }
    }

    // instead of a hierarchy, enrages are a whitelist
    get enrageHierarchy(): Hierarchy {
        return {
            enr500: ['enr500', 'enr1000', 'enr2000', 'enr4000', 'rd500', 'rd1000', 'rd2000', 'rd4000', 'rw500', 'rw1000', 'rw2000', 'rw4000', 'firstDevourer'],
            enr1000: ['enr1000', 'enr2000', 'enr4000', 'rd1000', 'rd2000', 'rd4000', 'rw1000', 'rw2000', 'rw4000', 'firstDevourer'],
            enr2000: ['enr2000', 'enr4000', 'rd2000', 'rd4000', 'rw2000', 'rw4000', 'firstDevourer'],
            enr4000: ['enr4000', 'rd4000', 'rw4000'],
            rd500: ['rd500', 'rd1000', 'rd2000', 'firstDevourer'], // not release day 4000!
            rd1000: ['rd1000', 'rd2000', 'firstDevourer'], // not release day 4000!
            rd2000: ['rd2000', 'firstDevourer'], // not release day 4000!
            rd4000: ['rd4000'],
            rw500: ['rd500', 'rd1000', 'rd2000', 'rw500', 'rw1000', 'rw2000', 'firstDevourer'], // not release week 4000!
            rw1000: ['rd1000', 'rd2000', 'rw1000', 'rw2000', 'firstDevourer'], // not release week 4000!
            rw2000: ['rd2000', 'rw2000', 'firstDevourer'], // not release week 4000!
            rw4000: ['rd4000', 'rw4000'],
        }
    }

    public stripRole = (role: string) => {
        return role.slice(3, -1)
    }

    public getKeyFromValue = (obj: any, value: string): any => {
        return Object.keys(obj).find(key => obj[key] === value)
    }

    public capitalizeFirstLetter = (str: string) => {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    public categorize = (role: string): string => {
        let category = '';
        if (this.categories.killCount.includes(role)) {
            category = 'killCount';
        } else if (this.categories.collectionLog.includes(role)) {
            category = 'collectionLog';
        } else if (this.categories.serverPings.includes(role)) {
            category = 'serverPings';
        } else if (this.categories.vanity.includes(role)) {
            category = 'vanity';
        } else if (this.categories.enrage.includes(role)) {
            category = 'enrage';
        } else {
            category = ''
        }
        return category;
    }

    public categorizeChannel = (role: string) => {
        const overrides = {
            roleConfirmations: [''],
        }
        if (this.categories.killCount.includes(role) || this.categories.collectionLog.includes(role) || this.categories.vanity.includes(role) || this.categories.enrage.includes(role)) {
            return 'achievementsAndLogs'
        } else if (overrides.roleConfirmations.includes(role)) {
            return 'roleConfirmations'
        } else {
            return ''
        }
    }

    public hasRolePermissions = async (client: Bot, roleList: string[], interaction: Interaction) => {
        if (this.config.owners.includes(interaction.user.id)) return true;
        if (!interaction.inCachedGuild()) return;
        const validRoleIds = roleList.map((key) => client.roleIds[key]);
        const user = await interaction.guild.members.fetch(interaction.user.id);
        const userRoles = user.roles.cache.map((role) => role.id);
        const intersection = validRoleIds.filter((roleId) => userRoles.includes(roleId));
        return intersection.length > 0;
    }

    public hasRolePermissionsMessage = async (client: Bot, roleList: string[], message: Message) => {
        if (this.config.owners.includes(message.member!.id)) return true;
        if (!message.inGuild()) return;
        const validRoleIds = roleList.map((key) => client.roleIds[key]);
        const user = await message.member!;
        const userRoles = user.roles.cache.map((role) => role.id);
        const intersection = validRoleIds.filter((roleId) => userRoles.includes(roleId));
        return intersection.length > 0;
    }

    public hasOverridePermissions = async (interaction: Interaction, feature: string) => {
        if (!interaction.inCachedGuild()) return;
        const { dataSource } = this.client;
        const repository = dataSource.getRepository(Override);

        const existingPermissions = await repository.findOne({
            where: {
                user: interaction.user.id,
                feature: feature
            }
        })

        return existingPermissions ? true : false;
    }

    public deleteMessage(interaction: ChatInputCommandInteraction<any>, id: string) {
        return interaction.channel?.messages.fetch(id).then((message) => message.delete());
    }

    public removeArrayIndex(array: Array<any>, indexID: number): any[] {
        return array.filter((_: any, index) => index != indexID - 1);
    }

    public checkURL(string: string): boolean {
        try {
            new URL(string);
            return true;
        } catch (error) {
            return false;
        }
    }

    public trim(string: string, max: number): string {
        return string.length > max ? string.slice(0, max) : string;
    }

    public convertMS(ms: number | null): string {
        if (!ms) return 'n/a';
        let seconds = (ms / 1000).toFixed(1),
            minutes = (ms / (1000 * 60)).toFixed(1),
            hours = (ms / (1000 * 60 * 60)).toFixed(1),
            days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
        if (Number(seconds) < 60) return seconds + ' Sec';
        else if (Number(minutes) < 60) return minutes + ' Min';
        else if (Number(hours) < 24) return hours + ' Hrs';
        else return days + ' Days';
    }

    public convertBytes(bytes: number): string {
        const MB = Math.floor((bytes / 1024 / 1024) % 1000);
        const GB = Math.floor(bytes / 1024 / 1024 / 1024);
        if (MB >= 1000) return `${GB.toFixed(1)} GB`;
        else return `${Math.round(MB)} MB`;
    }

    public isValidTime = (timeString: string): boolean => {
        const pattern = /^(0?[0-9]|1[0-9]|2[0-3]):([0-9]|[0-5][0-9])(\.[0-9])?$/gm;
        return pattern.test(timeString);
    }

    public async reuploadImage(url: string): Promise<string> {
        console.log(`--- DEBUG: Entered reuploadImage function for URL: ${url}`);

        const assetChannelId = this.client.channelIds.botAssetChannel;
        console.log(`--- DEBUG: Read assetChannelId from this.channels. It is: ${assetChannelId}`);

        if (!assetChannelId || assetChannelId === 'YOUR_CHANNEL_ID_HERE') {
            console.error('--- DEBUG: FATAL: botAssetChannel is not configured in the environment variables or is set to placeholder.');
            this.client.logger.error({
                message: 'botAssetChannel is not configured!',
                error: new Error('Asset channel not set or is placeholder.'),
                handler: 'UtilityHandler'
            });
            return url;
        }

        try {
            console.log(`--- DEBUG: Attempting to fetch channel ${assetChannelId}`);
            const botAssetChannel = await this.client.channels.fetch(assetChannelId) as TextChannel;
            if (!botAssetChannel) {
                throw new Error(`Could not find the asset channel with ID: ${assetChannelId}`);
            }

            console.log(`--- DEBUG: Fetching image from ${url}`);
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }

            const attachment = new AttachmentBuilder(Buffer.from(response.data, 'binary'), { name: 'image.png' });

            console.log(`--- DEBUG: Sending attachment to Discord channel...`);
            const message = await botAssetChannel.send({ files: [attachment] });
            const newUrl = message.attachments.first()!.url;

            console.log(`--- DEBUG: Successfully re-uploaded. New URL: ${newUrl}`);
            return newUrl;
        } catch (error: any) {
            this.client.logger.error({
                message: `--- DEBUG: FAILED during reuploadImage for URL: ${url}`,
                error: error,
                handler: 'UtilityHandler'
            });
            console.error(error);
            return url;
        }
    }

    //#region componentsV2

    //cleans up a componentsV2-container
    public static cleanContainer(containerData: any, disableControls: boolean = false) :any {
        const newContainer: any = {};

        if (containerData.type) newContainer.type = containerData.type;
        if (containerData.accentColor) newContainer.accent_color = containerData.accentColor;

        if (containerData.components?.length > 0) {
            //depending on component type...
            newContainer.components = containerData.components.map((component: any) => {
                return this.cleanComponent(component, disableControls);
            });
        }

        return newContainer;
    }

    private static cleanComponent(node: any, disableControls: boolean = false) :any {
        let result: any = {};

        //ActionRow
        if (node.type == 1) {
            result = {
                type: node.type
            };

            result.components = node.components.map((component: any) => {
                return this.cleanComponent(component, disableControls);
            });
        }

        //Button
        if (node.type == 2) {
            result = {
                type: node.type,
                style: node.style,
                custom_id: node.customId,
                disabled: disableControls
            };

            if (node.label) result.label = node.label;
            if (node.emoji) result.emoji = node.emoji;
            if (node.url) result.url = node.url;
        }

        //String Select
        if (node.type == 3) {
            result = {
                type: node.type,
                custom_id: node.customId,
                disabled: disableControls
            };

            if (node.placeholder) result.placeholder = node.placeholder;
            if (node.minValues) result.min_values = node.minValues;
            if (node.maxValues) result.max_values = node.maxValues;

            result.options = node.options.map((option: any) => {
                let optionResult: any = {};

                if (option.label) optionResult.label = option.label;
                if (option.value) optionResult.value = option.value;
                if (option.description) optionResult.description = option.description;

                if (option.emoji) {
                    const emoji: any = {};

                    if (option.emoji.name) emoji.name = option.emoji.name;
                    if (option.emoji.id) emoji.id = option.emoji.id;
                    if (option.emoji.animated) emoji.animated = option.emoji.animated;

                    optionResult.emoji = emoji;
                }

                return optionResult;
            });
        }

        //User Select
        if (node.type == 5) {
            result = {
                type: node.type,
                custom_id: node.customId,
                disabled: disableControls
            };

            if (node.placeholder) result.placeholder = node.placeholder;
            if (node.minValues) result.min_values = node.minValues;
            if (node.maxValues) result.max_values = node.maxValues;
        }

        //Section
        if (node.type == 9) {
            result = {
                type: node.type
            };

            result.components = node.components.map((component: any) => {
                return this.cleanComponent(component, disableControls);
            });

            result.accessory = this.cleanComponent(node.accessory, disableControls);
        }

        //Text Display
        if (node.type == 10) {
            result = {
                type: node.type,
                content: node.content
            };
        }

        //Thumbnail
        if (node.type == 11) {
            result = {
                type: node.type,
                media: {
                    url: node.media.url
                }
            };

            if (node.description) result.description = node.description;
        }

        //Media Gallery
        if (node.type == 12) {
            result = {
                type: node.type
            };

            result.items = node.items.map((item: any) => {
                let itemResult: any = {};

                itemResult.media = {
                    url: item.media.url
                };

                if (item.description) itemResult.description = item.description;

                return itemResult;
            });
        }

        //Separator
        if (node.type == 14) {
            result = {
                type: node.type,
                spacing: node.spacing
            };
        }

        //Container
        if (node.type == 17) {
            result = {
                type: node.type
            };

            if (node.accentColor) result.accent_color = node.accentColor;

            result.components = node.components.map((component: any) => {
                return this.cleanComponent(component, disableControls);
            });
        }

        return result;
    }

    //#endregion

    //#region Builders

    public getContainerBuilder(success: boolean | null, title: string) : ContainerBuilder {
        const container = new ContainerBuilder();

        if (success === true) container.setAccentColor(this.colours.green).addTextDisplayComponents(builder => builder.setContent(`${title}`)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
        if (success === false) container.setAccentColor(this.colours.red).addTextDisplayComponents(builder => builder.setContent(`${title}`)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
        if (success === null) container.setAccentColor(this.client.color).addTextDisplayComponents(builder => builder.setContent(`${title}`)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

        return container;
    }

    //#endregion

    //#region Timeout

    public parseDuration(input: string): number | null {
        const match = input.match(/^(\d+)([smhdw])$/i);
        if (!match) return null;

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        const multipliers = {
            's': 1000,
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000,
            'w': 7 * 24 * 60 * 60 * 1000
        };

        const ms = value * multipliers[unit as keyof typeof multipliers];
        const maxTimeout = 28 * 24 * 60 * 60 * 1000;

        return ms <= maxTimeout ? ms : null;
    }

    public async timeout(issuedBy: GuildMember | null, member: GuildMember, duration: string, reason: string, type: number = 0): Promise<boolean> {
        try {
            const { dataSource } = this.client;
            const repository = dataSource.getRepository(Timeout);

            const durationValue = this.parseDuration(duration);
            const expiresAt = new Date(Date.now() + duration);
            const issuer = issuedBy?.id ?? this.client.user!.id

            if (type === 0) {
                await member.timeout(durationValue, reason);
            } else if (type === 1) {
                await member.roles.add(this.client.roleIds.teamformingTimeout).catch(() => {});
            }

            const timeoutRecord = repository.create({
                user: member.id,
                reason,
                issuedBy: issuer,
                expiresAt,
                isActive: true,
                type
            });
            await repository.save(timeoutRecord);

            return true;
        } catch (error) {
            return false;
        }
    }

    //#endregion
}
