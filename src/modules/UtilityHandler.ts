import { EmbedBuilder, ChatInputCommandInteraction, Interaction, AttachmentBuilder, TextChannel, GuildMember, Message, Collection, FetchMessagesOptions, User, ContainerBuilder } from 'discord.js';
import Bot from '../Bot';
import * as config from '../../config.json';
import { Override } from '../entity/Override';
import axios from 'axios';
import { Timeout } from '../entity/Timeout';
import { Warning } from '../entity/Warning';

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

interface RoleMap {
    [key: string]: string;
}

interface AutomodResult {
    reason: string
    evidence: string
    timeout: boolean
    ban: boolean
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
            killCount: ['kc100', 'kc250', 'kc500', 'kc750', 'kc1000', 'kc1500', 'kc2000', 'kc3000', 'kc5000', 'kc7500', 'kc10000'],
            collectionLog: ['visionmaker', 'silverSpoon', 'goldenSpoon', 'mask5', 'top5', 'bottom5', 'gloves5', 'boots5', 'guard5', 'light5', 'pet', 'nexus5', 'devoured', 'tumekensLight'],
            serverPings: ['serverAnnouncements', 'goodMorning'],
            vanity: ['silverSpoon', 'goldenSpoon'],
            enrage: ['enr500', 'enr1000', 'enr2000', 'enr4000', 'rd500', 'rd1000', 'rd2000', 'rd4000', 'rw500', 'rw1000', 'rw2000', 'rw4000']
        }
    }

    get hierarchy(): Hierarchy {
        return {
            killCount: ['kc100', 'kc250', 'kc500', 'kc750', 'kc1000', 'kc1500', 'kc2000', 'kc3000', 'kc5000', 'kc7500', 'kc10000'],
        }
    }

    get trialHierarchy(): string[] {
        return ['elite500', 'elite1000', 'elite2000', 'master1000', 'master2000'];
    }

    get trialNotifyRoles(): RoleMap {
        return {
            elite500: 'notifyElite500',
            elite1000: 'notifyElite1000',
            elite2000: 'notifyElite2000',
            master1000: 'notifyMaster1000',
            master2000: 'notifyMaster2000'
        };
    }

    get trialeeRoles(): RoleMap {
        return {
            elite500: 'elite500trialee',
            elite1000: 'elite1000trialee',
            elite2000: 'elite2000trialee',
            master1000: 'master1000trialee',
            master2000: 'master2000trialee'
        };
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

    public isTrialTier = (role: string): boolean => {
        return this.trialHierarchy.includes(role);
    }

    public isMasterTrialTier = (role: string): boolean => {
        return role.startsWith('master');
    }

    public getTrialTierIndex = (role: string): number => {
        return this.trialHierarchy.indexOf(role);
    }

    public getTrialTierFromEnrage = (enrage: string): string | null => {
        switch (enrage) {
            case '500':
                return 'elite500';
            case '1000':
                return 'elite1000';
            case '2000':
                return 'elite2000';
            default:
                return null;
        }
    }

    public getTrialTierFromTrialeeRole = (memberOrRoleIds: GuildMember | string[]): string | null => {
        const userRoleIds = Array.isArray(memberOrRoleIds)
            ? memberOrRoleIds
            : memberOrRoleIds.roles.cache.map((role) => role.id);

        for (const roleKey of [...this.trialHierarchy].reverse()) {
            const trialeeRoleKey = this.trialeeRoles[roleKey];
            const trialeeRoleId = this.client.roleIds[trialeeRoleKey];

            if (trialeeRoleId && userRoleIds.includes(trialeeRoleId)) {
                return roleKey;
            }
        }

        return null;
    }

    public resolveTrialAwardRole = (member: GuildMember, fallbackEnrage: string | null = null): string | null => {
        const trialeeRole = this.getTrialTierFromTrialeeRole(member);

        if (trialeeRole) {
            return trialeeRole;
        }

        if (!fallbackEnrage) {
            return null;
        }

        return this.getTrialTierFromEnrage(fallbackEnrage);
    }

    public canVouchForTrialRole = (userRoleIds: string[], requestedRole: string): boolean => {
        const roleIndex = this.getTrialTierIndex(requestedRole);

        if (roleIndex === -1) {
            return false;
        }

        return this.trialHierarchy.slice(roleIndex).some((roleKey) => {
            const roleId = this.client.roleIds[roleKey];
            return Boolean(roleId && userRoleIds.includes(roleId));
        });
    }

    public getTrialAwardRoleKeys = (role: string): string[] => {
        const roleIndex = this.getTrialTierIndex(role);

        if (roleIndex === -1) {
            return [];
        }

        const lowerRoles = this.trialHierarchy.slice(0, roleIndex).reverse();
        const coverRoles = this.isMasterTrialTier(role) ? ['master', 'elite'] : ['elite'];
        const notifyRole = this.trialNotifyRoles[role];

        return [...new Set([role, ...coverRoles, ...lowerRoles, ...(notifyRole ? [notifyRole] : [])])];
    }

    public getRoleIdsFromKeys = (roleKeys: string[]): string[] => {
        return [...new Set(roleKeys
            .map((roleKey) => this.client.roleIds[roleKey])
            .filter((roleId): roleId is string => Boolean(roleId)))];
    }

    public getRoleMentionsFromKeys = (roleKeys: string[]): string[] => {
        return [...new Set(roleKeys
            .map((roleKey) => this.client.roles[roleKey])
            .filter((roleMention): roleMention is string => Boolean(roleMention)))];
    }

    public getUnownedRoleKeys = (existingRoleIds: string[], roleKeys: string[]): string[] => {
        return roleKeys.filter((roleKey) => {
            const roleId = this.client.roleIds[roleKey];
            return Boolean(roleId && !existingRoleIds.includes(roleId));
        });
    }

    public getTrialAwardRoleIds = (role: string): string[] => {
        return this.getRoleIdsFromKeys(this.getTrialAwardRoleKeys(role));
    }

    public getTrialAwardRoleMentions = (role: string): string[] => {
        return this.getRoleMentionsFromKeys(this.getTrialAwardRoleKeys(role));
    }

    public getTrialeeRoleKey = (role: string): string | null => {
        return this.trialeeRoles[role] ?? null;
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
            achievements: [''],
        }
        if (this.categories.killCount.includes(role) || this.categories.collectionLog.includes(role) || this.categories.vanity.includes(role) || this.categories.enrage.includes(role)) {
            return 'achievements'
        } else if (overrides.achievements.includes(role)) {
            return 'achievements'
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

    public async reuploadImage(url: string, filename?: string): Promise<string> {
        console.log(`--- DEBUG: Entered reuploadImage function for URL: ${url}`);

        const assetChannelId = this.client.channelIds.godImageStorage;
        console.log(`--- DEBUG: Read assetChannelId from this.channels. It is: ${assetChannelId}`);

        if (!assetChannelId || assetChannelId === 'YOUR_CHANNEL_ID_HERE') {
            console.error('--- DEBUG: FATAL: godImageStorage is not configured in the environment variables or is set to placeholder.');
            this.client.logger.error({
                message: 'godImageStorage is not configured!',
                error: new Error('Asset channel not set or is placeholder.'),
                handler: 'UtilityHandler'
            });
            return url;
        }

        try {
            console.log(`--- DEBUG: Attempting to fetch channel ${assetChannelId}`);
            const godImageStorage = await this.client.channels.fetch(assetChannelId) as TextChannel;
            if (!godImageStorage) {
                throw new Error(`Could not find the asset channel with ID: ${assetChannelId}`);
            }

            console.log(`--- DEBUG: Fetching image from ${url}`);
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }

            const attachmentName = filename || 'image.png';
            const attachment = new AttachmentBuilder(Buffer.from(response.data, 'binary'), { name: attachmentName });

            console.log(`--- DEBUG: Sending attachment to Discord channel with name: ${attachmentName}...`);
            const message = await godImageStorage.send({ files: [attachment] });
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

    public static async readAllMessages(channel: TextChannel): Promise<Collection<string, Message<true>>> {
        let messages = new Collection<string, Message<true>>();
        let lastId: string | undefined;

        while (true) {
            const options: FetchMessagesOptions = { limit: 100 };
            if (lastId) options.before = lastId;

            const fetched = await channel.messages.fetch(options);
            if (fetched.size === 0) break;


            messages = messages.concat(fetched);
            lastId = fetched.last()?.id;
        }

        messages = messages.reverse();

        return messages;
    }

    //#region Timeout

    public parseDuration(input: string): number | null {
        const match = input.match(/^(\d+)([smhdwy])$/i);
        if (!match) return null;

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        const multipliers = {
            's': 1000,
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000,
            'w': 7 * 24 * 60 * 60 * 1000,
            'y': 365 * 24 * 60 * 60 * 1000
        };

        const ms = value * multipliers[unit as keyof typeof multipliers];
        const maxTimeout = 10 * 365 * 24 * 60 * 60 * 1000;

        return ms <= maxTimeout ? ms : null;
    }

    public async timeout(issuedBy: GuildMember | null, member: GuildMember, duration: string, reason: string, type: number = 0): Promise<boolean> {
        try {
            const { dataSource } = this.client;
            const repository = dataSource.getRepository(Timeout);

            const durationValue = this.parseDuration(duration);
            const expiresAt = new Date(Date.now() + (durationValue ?? 0));
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

    //#region Warnings

    public async GetWarnings(user: User | null = null, id: number | null = null, reportRef: TextChannel | null = null): Promise<ContainerBuilder> {
        // List warnings
        const repository = this.client.dataSource.getRepository(Warning);
        let foundWarnings: Warning[] | null = await repository.find({
            order: {
                createdAt: 'ASC'
            }
        });
        let filters: string = '';

        if (id) {
            foundWarnings = foundWarnings.filter(x => x.id === id);
            filters += `\n- **ID:** \`${id}\``;
        }

        if (user) {
            foundWarnings = foundWarnings.filter(x => x.user === user.id);
            filters += `\n- **User:** <@${user.id}>`;
        }

        if (reportRef) {
            foundWarnings = foundWarnings.filter(x => x.reportRef === reportRef.id);
            filters += `\n- **Report reference:** \`${reportRef}\``;
        }

        if (foundWarnings.length > 0 && foundWarnings.length < 25) {
            const response = this.client.cv2.getContainerBuilder(null, `List warnings - \`${foundWarnings.length}\` found`);

            let content: string = '';

            if (id) {
                content = `Found warning for ID \`${id}\`:\n\n`
            } else if (user) {
                content = `Found warnings for User <@${user.id}>:\n\n`
            } else if (reportRef) {
                content = `Found warnings for report reference \`${reportRef}\`:\n\n`
            } else {
                content = `Found warnings:\n\n`
            }

            for (const warning of foundWarnings) {
                if (id) {
                    content += `**User:** <@${warning.user}>\n`
                    content += `**Reason:** \`${warning.reason}\`\n`;
                    if (warning.reportRef) content += `**Report reference:** <#${warning.reportRef}>\n`;
                } else if (user) {
                    content += `**ID:** \`${warning.id}\`\n`;
                    content += `**Reason:** \`${warning.reason}\`\n`;
                    if (warning.reportRef) content += `**Report reference:** <#${warning.reportRef}>\n`;
                } else {
                    content += `**ID:** \`${warning.id}\`\n`;
                    content += `**User:** <@${warning.user}>\n`;
                    content += `**Reason:** \`${warning.reason}\`\n`;
                    if (warning.reportRef) content += `**Report reference:** <#${warning.reportRef}>\n`;
                }
                content += '\n';
            }

            content = content.trim();

            response.addTextDisplayComponents(builder => builder.setContent(content));

            return response;
        } else if (foundWarnings.length >= 25) {
            const response = this.client.cv2.getContainerBuilder(false, 'List warnings')
                .addTextDisplayComponents(builder => builder.setContent(`Found too many warnings (\`${foundWarnings.length}\`), please specify your search until a proper pagination system is implemented.`));
            return response;
        } else {
            const response = this.client.cv2.getContainerBuilder(false, 'List warnings')
                .addTextDisplayComponents(builder => builder.setContent(`Could not find any warnings for the specified filters:${filters.length > 0 ? filters : '\n- No filters provided'}`));
            return response;
        }
    }

    //#endregion

    //#region Automod

    private static readonly larryKeywords = [
        'c8c5f8ae0b965884472f386dd74b7d83',
        'https://cdn.discordapp.com/attachments/1448810146233978971/1448811713989447951/66c3ea4a17054804ffc2b1748f4f75aa.png?ex=693c9e8e&is=693b4d0e&hm=ac8bb72ccc16af6a5a4786772942abc4a04be392e0f5cdd58d62343cd4e9f4a1&',
        '66c3ea4a17054804ffc2b1748f4f75aa',
        '1448810146233978971'
    ];

    public static checkAutomod(checkVal: string): AutomodResult {
        const retVal: AutomodResult = { reason: "No reason provided", evidence: "", ban: false, timeout: false};

        // Larry
        for (const keyword of UtilityHandler.larryKeywords) {
            if (checkVal.includes(keyword)) {
                retVal.evidence = keyword;
                retVal.reason = "Larry";
                retVal.ban = true;
                break;
            }
        }

        return retVal;
    }

    //#endregion
}
