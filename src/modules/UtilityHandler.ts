import { EmbedBuilder, ChatInputCommandInteraction, Interaction, APIEmbedField, AttachmentBuilder, TextChannel } from 'discord.js';
import Bot from '../Bot';
import * as config from '../../config.json';
import { Override } from '../entity/Override';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DpmSubmission } from '../entity/DpmSubmission';
import { KillTimeSubmission } from '../entity/KillTimeSubmission';
import axios from 'axios';
import { getRoles, getChannels } from '../GuildSpecifics';

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
    threeSeven: string[]
    duo: string[]
    combined: string[]
    serverPings: string[]
    vanity: string[]
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

    // DPM thresholds - now reads from configuration file
    private _dpmCache: any = null;
    private _dpmCacheTime: number = 0;
    private readonly DPM_CACHE_DURATION = 30000; // 30 seconds cache

    async getDpm() {
        // Check cache first
        const now = Date.now();
        if (this._dpmCache && (now - this._dpmCacheTime) < this.DPM_CACHE_DURATION) {
            return this._dpmCache;
        }

        try {
            const dpmConfigPath = path.join(process.cwd(), 'dpm-thresholds.json');
            const configData = await fs.readFile(dpmConfigPath, 'utf-8');
            const config = JSON.parse(configData);

            this._dpmCache = config.thresholds;
            this._dpmCacheTime = now;

            return config.thresholds;
        } catch (error) {
            // Fallback to hardcoded values if file doesn't exist or is invalid
            this.client.logger.error({
                message: 'Failed to read DPM thresholds config, using defaults',
                error,
                handler: 'UtilityHandler'
            });

            const defaultThresholds = {
                'adept': 400,
                'mastery': 475,
                'extreme': 590
            };

            this._dpmCache = defaultThresholds;
            this._dpmCacheTime = now;

            return defaultThresholds;
        }
    }

    // Synchronous getter for backward compatibility (will be deprecated)
    get dpm() {
        // If cache exists and is fresh, return it
        const now = Date.now();
        if (this._dpmCache && (now - this._dpmCacheTime) < this.DPM_CACHE_DURATION) {
            return this._dpmCache;
        }

        // Return default values for immediate use
        return {
            'adept': 400,
            'mastery': 475,
            'extreme': 590
        };
    }

    // Method to update DPM thresholds
    async updateDpmThresholds(newThresholds: any, updatedBy: string) {
        const dpmConfigPath = path.join(process.cwd(), 'dpm-thresholds.json');

        // Validate thresholds
        const validatedThresholds = this.validateDpmThresholds(newThresholds);
        if (!validatedThresholds.isValid) {
            throw new Error(validatedThresholds.error);
        }

        const config = {
            thresholds: newThresholds,
            lastUpdated: new Date().toISOString(),
            updatedBy: updatedBy
        };

        await fs.writeFile(dpmConfigPath, JSON.stringify(config, null, 2));

        // Clear cache to force reload
        this._dpmCache = null;
        this._dpmCacheTime = 0;

        this.client.logger.log({
            message: `DPM thresholds updated by ${updatedBy}`,
            handler: 'UtilityHandler'
        }, true);
    }

    // Validate DPM thresholds
    private validateDpmThresholds(thresholds: any): { isValid: boolean, error?: string } {
        const requiredKeys = ['adept', 'mastery', 'extreme'];

        for (const key of requiredKeys) {
            if (!thresholds.hasOwnProperty(key)) {
                return { isValid: false, error: `Missing required threshold: ${key}` };
            }
            if (typeof thresholds[key] !== 'number' || thresholds[key] < 0) {
                return { isValid: false, error: `Invalid threshold value for ${key}: must be a positive number` };
            }
        }

        // Check ordering: adept < mastery < extreme
        if (thresholds.adept >= thresholds.mastery ||
            thresholds.mastery >= thresholds.extreme) {
            return { isValid: false, error: 'Thresholds must be in ascending order: adept < mastery < extreme' };
        }

        return { isValid: true };
    }

    // Get DPM role ID based on DPM value
    public async getDpmRole(dpm: number): Promise<string> {
        let roleToAssign;
        const { stripRole } = this;
        const { adept, mastery, extreme } = await this.getDpm();

        if (dpm >= extreme) {
            roleToAssign = 'extreme';
        } else if (dpm >= mastery) {
            roleToAssign = 'mastery';
        } else if (dpm >= adept) {
            roleToAssign = 'adept';
        }

        if (!roleToAssign) return '';

        return stripRole(getRoles(process.env.GUILD_ID)[roleToAssign]);
    }

    get categories(): Categories {
        return {
            killCount: ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic', 'solakSlave', 'solakSimp', 'solakLegend'],
            collectionLog: ['nightOutWithMyRightHand', 'probablyUsesSpecialScissors', 'oneForTheBooks', 'brokenPrinter', 'merethielsSimp', 'shroomDealer', 'guardianOfTheGrove'],
            threeSeven: ['noRealm', 'threeSevenRootskips', 'threeSevenExperienced', 'threeSevenMaster', 'threeSevenGrandmaster'],
            duo: ['duoRootskips', 'duoExperienced', 'duoMaster', 'duoGrandmaster'],
            combined: ['rootskips', 'experienced', 'master', 'grandmaster'],
            serverPings: ['serverAnnouncements', 'goodMorning'],
            vanity: ['silverSpoon', 'goldenSpoon', 'releaseWeek500', 'releaseWeek1k', 'sunforged', 'lightbearer', 'releaseDay4k', 'catBoundInitiate', 'scarabMarkedDisciple', 'whispererOfTheWanderer', 'bearerOfTheUnholySigil', 'fangOfTheDevourer', 'visionmaker', 'tumekenMask', 'tumekenRobeTop', 'tumekenRobeBottom', 'tumekenGloves', 'tumekenBoots', 'devourersGuard', 'tumekensLight', 'amaskitty']
        }
    }

    get hierarchy(): Hierarchy {
        return {
            killCount: ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic', 'solakSlave', 'solakSimp', 'solakLegend'],
            collectionLog: ['nightOutWithMyRightHand', 'probablyUsesSpecialScissors', 'oneForTheBooks', 'brokenPrinter', 'merethielsSimp', 'shroomDealer', 'guardianOfTheGrove'],
            threeSeven: ['noRealm', 'threeSevenRootskips', 'threeSevenExperienced', 'threeSevenMaster', 'threeSevenGrandmaster'],
            duo: ['duoRootskips', 'duoExperienced', 'duoMaster', 'duoGrandmaster'],
            combined: ['rootskips', 'experienced', 'master', 'grandmaster'],
            serverPings: ['serverAnnouncements', 'goodMorning']
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
        } else if (this.categories.threeSeven.includes(role)) {
            category = 'threeSeven';
        } else if (this.categories.duo.includes(role)) {
            category = 'duo';
        } else if (this.categories.combined.includes(role)) {
            category = 'combined';
        } else if (this.categories.serverPings.includes(role)) {
            category = 'serverPings';
        } else if (this.categories.vanity.includes(role)) {
            category = 'vanity';
        } else {
            category = ''
        }
        return category;
    }

    public categorizeChannel = (role: string) => {
        const overrides = {
            roleConfirmations: ['erethdorsBane', 'solakWRHolder', 'fours'],
        }
        if (this.categories.killCount.includes(role) || this.categories.collectionLog.includes(role) || this.categories.vanity.includes(role)) {
            return 'achievementsAndLogs'
        } else if (overrides.roleConfirmations.includes(role) || this.categories.combined.includes(role) || this.categories.duo.includes(role) || this.categories.threeSeven.includes(role)) {
            return 'roleConfirmations'
        } else {
            return ''
        }
    }

    public hasRolePermissions = async (client: Bot, roleList: string[], interaction: Interaction) => {
        if (this.config.owners.includes(interaction.user.id)) return true;
        if (!interaction.inCachedGuild()) return;
        const validRoleIds = roleList.map((key) => this.stripRole(getRoles(interaction.guild.id)[key]));
        const user = await interaction.guild.members.fetch(interaction.user.id);
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

    public isValidDamage = (damageString: string): boolean => {
        return !isNaN(+damageString);
    }

    public calcDPMInThousands(damage: string, time: string) {
        const [minutes, seconds] = time.split(':').map(Number);
        const secondsAsMinutes = seconds / 60;
        const totalMinutes = minutes + secondsAsMinutes;
        return Math.round((+damage) / totalMinutes / 10) / 100;
    }

    public checkForUserId = (userId: string, objects: APIEmbedField[]): { obj: APIEmbedField, index: number } | undefined => {
        for (let i = 0; i < objects.length; i++) {
            if (objects[i].value === userId) {
                return { obj: objects[i], index: i };
            }
        }
        return undefined;
    };

    public getEmptyObject(targetName: string, objects: APIEmbedField[]): { obj: APIEmbedField, index: number } | undefined {
        const index = objects.findIndex(obj => obj.name === targetName && obj.value === '`Empty`');
        if (index >= 0) {
            const obj = objects[index];
            return { obj: obj, index: index };
        }
        return undefined;
    }

    public isTeamFull(players: APIEmbedField[]): boolean {
        return players.every(player => !player.value.includes('Empty'));
    }

    public async generateDpmLeaderboardEmbeds(): Promise<EmbedBuilder[]> {
        const dpmSubmissionRepository = this.client.dataSource.getRepository(DpmSubmission);

        const submissions = await dpmSubmissionRepository.find({
            where: { status: 'approved' },
            order: { dpm: "DESC" }
        });

        const rankEmojis: { [key: number]: string } = {
            1: this.emojis.gem1,
            2: this.emojis.gem2,
            3: this.emojis.gem3,
        };

        // Only these styles are eligible for the leaderboard
        // Magic, Ranged, and Melee submissions are accepted but not displayed here
        const leaderboardEligibleStyles = ['Hybrid', 'Tribrid', 'Necromancy'];
        const teamSizes = ['Duo', '4 man'];

        // Group submissions by team size first, then by style
        const groupedSubmissions: { [teamSize: string]: { [style: string]: DpmSubmission[] } } = {};

        // Initialize groups
        teamSizes.forEach(teamSize => {
            groupedSubmissions[teamSize] = {};
            leaderboardEligibleStyles.forEach(style => {
                groupedSubmissions[teamSize][style] = [];
            });
        });

        // Group submissions by team size and style (only leaderboard-eligible ones)
        submissions.forEach(submission => {
            if (groupedSubmissions[submission.teamSize] &&
                groupedSubmissions[submission.teamSize][submission.style]) {
                groupedSubmissions[submission.teamSize][submission.style].push(submission);
            }
        });

        const embeds: EmbedBuilder[] = [];

        teamSizes.forEach(teamSize => {
            const teamSubmissions = groupedSubmissions[teamSize];
            let teamHasSubmissions = false;

            // Check if this team size has any submissions
            for (const style of leaderboardEligibleStyles) {
                if (teamSubmissions[style].length > 0) {
                    teamHasSubmissions = true;
                    break;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`\`DPM Leaderboard - ${teamSize}\``)
                .setColor(this.client.color);

            let description = '';

            if (teamHasSubmissions) {
                leaderboardEligibleStyles.forEach(style => {
                    const styleSubmissions = teamSubmissions[style];
                    if (styleSubmissions.length > 0) {
                        description += `\n**${style}**\n`;
                        description += styleSubmissions
                            .slice(0, 3) // Limit to top 3 per style
                            .map((submission, index) => {
                                const rank = index + 1;
                                const rankDisplay = rankEmojis[rank] || `**${rank}.**`;
                                return `${rankDisplay} ${submission.rsn} - ${submission.dpm.toFixed(2)}k`;
                            }).join('\n');
                        description += '\n';
                    }
                });
            }

            if (description === '') {
                description = `No ${teamSize} DPM submissions yet.`;
            }

            embed.setDescription(description.trim());
            embed.setTimestamp();
            embed.setFooter({
                text: "To submit your DPM to the leaderboard use '/dpm-submit'"
            });

            embeds.push(embed);
        });

        return embeds;
    }

    public async generateKillTimeLeaderboardEmbed(): Promise<EmbedBuilder> {
        const killTimeSubmissionRepository = this.client.dataSource.getRepository(KillTimeSubmission);
        const submissions = await killTimeSubmissionRepository.find();

        const embed = new EmbedBuilder()
            .setTitle('`Kill Time Leaderboard`')
            .setColor(this.client.color)
            .setTimestamp()
            .setFooter({
                text: "To submit your kill time to the leaderboard use '/killtime-submit'"
            });

        if (submissions.length === 0) {
            embed.setDescription('No kill time submissions yet.');
            return embed;
        }

        const parseTimeToSeconds = (time: string): number => {
            const parts = time.split(':');
            const minutes = parseInt(parts[0], 10);
            const seconds = parseFloat(parts[1]);
            return (minutes * 60) + seconds;
        };

        submissions.sort((a, b) => parseTimeToSeconds(a.killTime) - parseTimeToSeconds(b.killTime));

        const rankEmojis: { [key: number]: string } = {
            1: this.emojis.gem1,
            2: this.emojis.gem2,
            3: this.emojis.gem3,
        };

        const groupedSubmissions: { [key: string]: KillTimeSubmission[] } = {
            'Duo': [],
            '4 man': [],
        };

        submissions.forEach(submission => {
            if (groupedSubmissions[submission.teamSize]) {
                groupedSubmissions[submission.teamSize].push(submission);
            }
        });

        let description = '';

        for (const teamSize in groupedSubmissions) {
            const styleSubmissions = groupedSubmissions[teamSize];
            if (styleSubmissions.length > 0) {
                description += `\n**${teamSize}**\n`;
                description += styleSubmissions
                    .slice(0, 3)
                    .map((submission, index) => {
                        const rank = index + 1;
                        const rankDisplay = rankEmojis[rank] || `**${rank}.**`;
                        const team = [submission.base, submission.dps1, submission.dps2, submission.dps3].filter(Boolean).join(', ');
                        return `${rankDisplay} [**${submission.killTime}**](${submission.vodLink}) - ${team}`;
                    }).join('\n');
                description += '\n';
            }
        }

        if (description === '') {
            description = 'No kill time submissions yet.';
        }

        embed.setDescription(description.trim());
        return embed;
    }

    public async reuploadImage(url: string): Promise<string> {
        console.log(`--- DEBUG: Entered reuploadImage function for URL: ${url}`);

        const assetChannelId = getChannels(process.env.GUILD_ID).botAssetChannel;
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
    public cleanContainer(containerData: any) :any {
        const newContainer: any = {};

        if (containerData.type) newContainer.type = containerData.type;
        if (containerData.accentColor) newContainer.accent_color = containerData.accentColor;

        if (containerData.components?.length > 0) {
            //depending on component type...
            newContainer.components = containerData.components.map((component: any) => {
                return this.cleanComponent(component);
            });
        }

        return newContainer;
    }

    private cleanComponent(node: any) :any {
        let result: any = {};

        //ActionRow
        if (node.type == 1) {
            result = {
                type: node.type
            };

            result.components = node.components.map((component: any) => {
                return this.cleanComponent(component);
            });
        }

        //Button
        if (node.type == 2) {
            result = {
                type: node.type,
                style: node.style,
                custom_id: node.customId
            };

            if (node.label) result.label = node.label;
            if (node.emoji) result.emoji = node.emoji;
            if (node.url) result.url = node.url;
        }

        //String Select
        if (node.type == 3) {
            result = {
                type: node.type,
                custom_id: node.customId
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
                custom_id: node.customId
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
                return this.cleanComponent(component);
            });

            result.accessory = this.cleanComponent(node.accessory);
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
                return this.cleanComponent(component);
            });
        }

        return result;
    }

    //#endregion
}
