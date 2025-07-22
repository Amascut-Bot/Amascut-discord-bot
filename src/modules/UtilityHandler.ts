import { EmbedBuilder, ChatInputCommandInteraction, Interaction, APIEmbedField, AttachmentBuilder, TextChannel, PermissionFlagsBits, ChannelType, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Bot from '../Bot';
import * as config from '../../config.json';
import { Override } from '../entity/Override';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DpmSubmission } from '../entity/DpmSubmission';
import { KillTimeSubmission } from '../entity/KillTimeSubmission';
import fetch from 'node-fetch';

export default interface UtilityHandler {
    client: Bot;
    config: typeof config;
    random(array: Array<any>): Array<number>;
    loadingEmbed: EmbedBuilder;
    loadingText: string;
    imageUrlCache: Map<string, string>;
    reuploadImage(url: string): Promise<string>;
}

interface Channels {
    [channelName: string]: string;
    botAssetChannel: string;
}

interface Roles {
    [roleName: string]: string;
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

    get channels(): Channels {
        if (process.env.ENVIRONMENT === 'DEVELOPMENT') {
            return {
                roleConfirmations: process.env.DEV_ROLE_CONFIRMATIONS_CHANNEL!,
                achievementsAndLogs: process.env.DEV_ACHIEVEMENTS_LOG_CHANNEL!,
                botRoleLog: process.env.DEV_BOT_ROLE_LOG_CHANNEL!,
                reportLog: process.env.DEV_REPORT_LOG_CHANNEL!,
                tempVCCategory: process.env.DEV_TEMP_VC_CATEGORY!,
                tempVCCreate: process.env.DEV_TEMP_VC_CREATE_CHANNEL!,
                dpmCalc: process.env.DEV_DPM_CALC_CHANNEL!,
                trialScheduling: process.env.DEV_TRIAL_SCHEDULING_CHANNEL!,
                reaperScheduling: process.env.DEV_REAPER_SCHEDULING_CHANNEL!,
                reaperSquad: process.env.DEV_REAPER_SQUAD_CHANNEL!,
                uploadLogChannel: process.env.DEV_UPLOAD_LOG_CHANNEL!,
                botAssetChannel: process.env.DEV_BOT_ASSET_CHANNEL!,
            }
        }
        return {
            roleConfirmations: process.env.PROD_ROLE_CONFIRMATIONS_CHANNEL!,
            achievementsAndLogs: process.env.PROD_ACHIEVEMENTS_LOG_CHANNEL!,
            botRoleLog: process.env.PROD_BOT_ROLE_LOG_CHANNEL!,
            reportLog: process.env.PROD_REPORT_LOG_CHANNEL!,
            tempVCCategory: process.env.PROD_TEMP_VC_CATEGORY!,
            tempVCCreate: process.env.PROD_TEMP_VC_CREATE_CHANNEL!,
            dpmCalc: process.env.PROD_DPM_CALC_CHANNEL!,
            trialScheduling: process.env.PROD_TRIAL_SCHEDULING_CHANNEL!,
            reaperScheduling: process.env.PROD_REAPER_SCHEDULING_CHANNEL!,
            reaperSquad: process.env.PROD_REAPER_SQUAD_CHANNEL!,
            uploadLogChannel: process.env.PROD_UPLOAD_LOG_CHANNEL!,
            botAssetChannel: process.env.PROD_BOT_ASSET_CHANNEL!,
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
        const { stripRole, roles } = this;
        const { adept, mastery, extreme } = await this.getDpm();

        if (dpm >= extreme) {
            roleToAssign = 'extreme';
        } else if (dpm >= mastery) {
            roleToAssign = 'mastery';
        } else if (dpm >= adept) {
            roleToAssign = 'adept';
        }

        if (!roleToAssign) return '';

        return stripRole(roles[roleToAssign]);
    }

    get roles(): Roles {
        if (process.env.ENVIRONMENT === 'DEVELOPMENT') {
            return {
                duoMaster: `<@&${process.env.DEV_DUO_MASTER_ROLE!}>`,
                threeSevenMaster: `<@&${process.env.DEV_3_7_MASTER_ROLE!}>`,
                master: `<@&${process.env.DEV_MASTER_ROLE!}>`,
                solakAddict: `<@&${process.env.DEV_SOLAK_ADDICT_ROLE!}>`,
                trialTeam: `<@&${process.env.DEV_TRIAL_TEAM_ROLE!}>`,
                            admin: `<@&${process.env.DEV_ADMIN_ROLE!}>`,
            owner: `<@&${process.env.DEV_OWNER_ROLE!}>`,
                duoRootskips: `<@&${process.env.DEV_DUO_ROOTSKIPS_ROLE!}>`,
                threeSevenRootskips: `<@&${process.env.DEV_3_7_ROOTSKIPS_ROLE!}>`,
                rootskips: `<@&${process.env.DEV_ROOTSKIPS_ROLE!}>`,
                noRealm: `<@&${process.env.DEV_NO_REALM_ROLE!}>`,
                duoExperienced: `<@&${process.env.DEV_DUO_EXPERIENCED_ROLE!}>`,
                threeSevenExperienced: `<@&${process.env.DEV_3_7_EXPERIENCED_ROLE!}>`,
                experienced: `<@&${process.env.DEV_EXPERIENCED_ROLE!}>`,
                teacher: `<@&${process.env.DEV_TEACHER_ROLE!}>`,
                learner: `<@&${process.env.DEV_LEARNER_ROLE!}>`,
                community: `<@&${process.env.DEV_COMMUNITY_ROLE!}>`,
                booster: `<@&${process.env.DEV_BOOSTER_ROLE!}>`,
                nitroBooster: `<@&${process.env.DEV_NITRO_BOOSTER_ROLE!}>`,
                cosmetic: `<@&${process.env.DEV_COSMETIC_ROLE!}>`,
                participant: `<@&${process.env.DEV_PARTICIPANT_ROLE!}>`,
                reaper: `<@&${process.env.DEV_REAPER_ROLE!}>`,
                tank: `<@&${process.env.DEV_TANK_ROLE!}>`,
                dps: `<@&${process.env.DEV_DPS_ROLE!}>`,
                support: `<@&${process.env.DEV_SUPPORT_ROLE!}>`,
                learnerOfTheWeek: `<@&${process.env.DEV_LEARNER_OF_THE_WEEK_ROLE!}>`,
                staff: `<@&${process.env.DEV_STAFF_ROLE!}>`,
                moderator: `<@&${process.env.DEV_MODERATOR_ROLE!}>`,
                solak: `<@&${process.env.DEV_SOLAK_ROLE!}>`,
                tempRole: `<@&${process.env.DEV_TEMP_ROLE!}>`,
                tankNotNeeded: `<@&${process.env.DEV_TANK_NOT_NEEDED_ROLE!}>`,
                dpsNotNeeded: `<@&${process.env.DEV_DPS_NOT_NEEDED_ROLE!}>`,
                supportNotNeeded: `<@&${process.env.DEV_SUPPORT_NOT_NEEDED_ROLE!}>`,
                learners: `<@&${process.env.DEV_LEARNERS_ROLE!}>`,
                learnersNotNeeded: `<@&${process.env.DEV_LEARNERS_NOT_NEEDED_ROLE!}>`,
                adept: `<@&${process.env.DEV_ADEPT_ROLE!}>`,
                mastery: `<@&${process.env.DEV_MASTERY_ROLE!}>`,
                extreme: `<@&${process.env.DEV_EXTREME_ROLE!}>`,
                serverAnnouncements: `<@&${process.env.DEV_SERVER_ANNOUNCEMENTS_ROLE!}>`,
                goodMorning: `<@&${process.env.DEV_GOOD_MORNING_ROLE!}>`,
            }
        }
        return {
            duoMaster: `<@&${process.env.PROD_DUO_MASTER_ROLE!}>`,
            threeSevenMaster: `<@&${process.env.PROD_3_7_MASTER_ROLE!}>`,
            master: `<@&${process.env.PROD_MASTER_ROLE!}>`,
            solakAddict: `<@&${process.env.PROD_SOLAK_ADDICT_ROLE!}>`,
            trialTeam: `<@&${process.env.PROD_TRIAL_TEAM_ROLE!}>`,
            admin: `<@&${process.env.PROD_ADMIN_ROLE!}>`,
            owner: `<@&${process.env.PROD_OWNER_ROLE!}>`,
            duoRootskips: `<@&${process.env.PROD_DUO_ROOTSKIPS_ROLE!}>`,
            threeSevenRootskips: `<@&${process.env.PROD_3_7_ROOTSKIPS_ROLE!}>`,
            rootskips: `<@&${process.env.PROD_ROOTSKIPS_ROLE!}>`,
            noRealm: `<@&${process.env.PROD_NO_REALM_ROLE!}>`,
            duoExperienced: `<@&${process.env.PROD_DUO_EXPERIENCED_ROLE!}>`,
            threeSevenExperienced: `<@&${process.env.PROD_3_7_EXPERIENCED_ROLE!}>`,
            experienced: `<@&${process.env.PROD_EXPERIENCED_ROLE!}>`,
            teacher: `<@&${process.env.PROD_TEACHER_ROLE!}>`,
            learner: `<@&${process.env.PROD_LEARNER_ROLE!}>`,
            community: `<@&${process.env.PROD_COMMUNITY_ROLE!}>`,
            booster: `<@&${process.env.PROD_BOOSTER_ROLE!}>`,
            nitroBooster: `<@&${process.env.PROD_NITRO_BOOSTER_ROLE!}>`,
            cosmetic: `<@&${process.env.PROD_COSMETIC_ROLE!}>`,
            participant: `<@&${process.env.PROD_PARTICIPANT_ROLE!}>`,
            reaper: `<@&${process.env.PROD_REAPER_ROLE!}>`,
            tank: `<@&${process.env.PROD_TANK_ROLE!}>`,
            dps: `<@&${process.env.PROD_DPS_ROLE!}>`,
            support: `<@&${process.env.PROD_SUPPORT_ROLE!}>`,
            learnerOfTheWeek: `<@&${process.env.PROD_LEARNER_OF_THE_WEEK_ROLE!}>`,
            staff: `<@&${process.env.PROD_STAFF_ROLE!}>`,
            moderator: `<@&${process.env.PROD_MODERATOR_ROLE!}>`,
            solak: `<@&${process.env.PROD_SOLAK_ROLE!}>`,
            tempRole: `<@&${process.env.PROD_TEMP_ROLE!}>`,
            tankNotNeeded: `<@&${process.env.PROD_TANK_NOT_NEEDED_ROLE!}>`,
            dpsNotNeeded: `<@&${process.env.PROD_DPS_NOT_NEEDED_ROLE!}>`,
            supportNotNeeded: `<@&${process.env.PROD_SUPPORT_NOT_NEEDED_ROLE!}>`,
            learners: `<@&${process.env.PROD_LEARNERS_ROLE!}>`,
            learnersNotNeeded: `<@&${process.env.PROD_LEARNERS_NOT_NEEDED_ROLE!}>`,
            adept: `<@&${process.env.PROD_ADEPT_ROLE!}>`,
            mastery: `<@&${process.env.PROD_MASTERY_ROLE!}>`,
            extreme: `<@&${process.env.PROD_EXTREME_ROLE!}>`,
            serverAnnouncements: `<@&${process.env.PROD_SERVER_ANNOUNCEMENTS_ROLE!}>`,
            goodMorning: `<@&${process.env.PROD_GOOD_MORNING_ROLE!}>`,
        }
    }

    get categories(): Categories {
            return {
                killCount: ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic', 'solakSlave', 'solakSimp', 'solakLegend'],
                collectionLog: ['nightOutWithMyRightHand', 'probablyUsesSpecialScissors', 'oneForTheBooks', 'brokenPrinter', 'merethielsSimp', 'shroomDealer', 'guardianOfTheGrove'],
                    threeSeven: ['noRealm', 'threeSevenRootskips', 'threeSevenExperienced', 'threeSevenMaster', 'threeSevenGrandmaster'],
                    duo: ['duoRootskips', 'duoExperienced', 'duoMaster', 'duoGrandmaster'],
            combined: ['rootskips', 'experienced', 'master', 'grandmaster'],
            serverPings: ['serverAnnouncements', 'goodMorning'],
                }
            }

    get hierarchy(): Hierarchy {
        return {
            killCount: ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic', 'solakSlave', 'solakSimp', 'solakLegend'],
            collectionLog: ['nightOutWithMyRightHand', 'probablyUsesSpecialScissors', 'oneForTheBooks', 'brokenPrinter', 'merethielsSimp', 'shroomDealer', 'guardianOfTheGrove'],
                threeSeven: ['noRealm', 'threeSevenRootskips', 'threeSevenExperienced', 'threeSevenMaster', 'threeSevenGrandmaster'],
                duo: ['duoRootskips', 'duoExperienced', 'duoMaster', 'duoGrandmaster'],
            combined: ['rootskips', 'experienced', 'master', 'grandmaster'],
            serverPings: ['serverAnnouncements', 'goodMorning'],
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
        } else {
            category = ''
        }
        return category;
    }

    public categorizeChannel = (role: string) => {
        const overrides = {
            roleConfirmations: ['erethdorsBane', 'solakWRHolder', 'fours'],
        }
        if (this.categories.killCount.includes(role) || this.categories.collectionLog.includes(role)) {
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
        const validRoleIds = roleList.map((key) => this.stripRole(this.roles[key]));
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
                .setColor(this.client.util.colours.lightblue);

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
            .setColor(this.client.util.colours.lightblue)
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

        const assetChannelId = this.channels.botAssetChannel;
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
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const attachment = new AttachmentBuilder(buffer, { name: 'image.png' });

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

    // Ticket System Utilities
    public async getNextTicketNumber(ticketType: string): Promise<number> {
        const ticketNumbersPath = path.join(process.cwd(), 'ticket-numbers.json');

        try {
            const data = await fs.readFile(ticketNumbersPath, 'utf-8');
            const ticketNumbers = JSON.parse(data);

            // Increment the number for this ticket type
            ticketNumbers[ticketType] = (ticketNumbers[ticketType] || 0) + 1;

            // Save back to file
            await fs.writeFile(ticketNumbersPath, JSON.stringify(ticketNumbers, null, 4));

            return ticketNumbers[ticketType];
        } catch (error) {
            this.client.logger.error({
                message: 'Failed to read/write ticket numbers file',
                error,
                handler: 'UtilityHandler'
            });

            // Fallback to 1 if file doesn't exist or is corrupted
            return 1;
        }
    }

    public async createTicketChannel(guild: any, ticketType: string, userId: string, ticketNumber: number): Promise<TextChannel | null> {
        try {
            const channelName = `${ticketType}-${ticketNumber.toString().padStart(4, '0')}`;

            // Get admin and owner role IDs
            const adminRoleId = this.stripRole(this.roles.admin);
            const ownerRoleId = this.stripRole(this.roles.owner);

            // Create the channel with proper permissions
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: null, // No category as requested
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    {
                        id: adminRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ManageChannels
                        ]
                    },
                    {
                        id: ownerRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });

            this.client.logger.log({
                message: `Created ticket channel: ${channelName} for user ${userId}`,
                handler: 'UtilityHandler'
            }, true);

            return channel;
        } catch (error) {
            this.client.logger.error({
                message: `Failed to create ticket channel for type: ${ticketType}`,
                error,
                handler: 'UtilityHandler'
            });
            return null;
        }
    }

    public async sendTicketWelcomeMessage(channel: TextChannel, userId: string, ticketType: string, formData: any): Promise<void> {
        try {
            const adminRole = this.roles.admin;
            const ownerRole = this.roles.owner;

            // Create welcome message
            const welcomeMessage = `<@${userId}>, your ticket has been created. An ${adminRole} or ${ownerRole} will be with you shortly.`;

            // Create embed with form data using fields for better organization
            const embed = new EmbedBuilder()
                .setTitle(`${this.capitalizeFirstLetter(ticketType)} Ticket`)
                .setColor(this.colours.lightblue)
                .setTimestamp()
                .setAuthor({
                    name: `User: ${channel.guild.members.cache.get(userId)?.user.username || 'Unknown User'}`,
                    iconURL: channel.guild.members.cache.get(userId)?.user.displayAvatarURL() || undefined
                });

            // Format the form data based on ticket type using fields
            switch (ticketType) {
                case 'suggestion':
                    embed.addFields(
                        { name: 'RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Suggestion', value: `\`\`\`${formData.suggestion}\`\`\``, inline: false },
                        { name: 'Why would this work?', value: `\`\`\`${formData.reason}\`\`\``, inline: false }
                    );
                    break;
                case 'report':
                    embed.addFields(
                        { name: 'RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Reported User', value: `\`\`\`${formData.reported_user}\`\`\``, inline: false },
                        { name: 'Reason', value: `\`\`\`${formData.reason}\`\`\``, inline: false },
                        { name: 'Description', value: `\`\`\`${formData.description}\`\`\``, inline: false }
                    );
                    break;
                case 'contentcreator':
                    embed.addFields(
                        { name: 'RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'Platform URL', value: `\`\`\`${formData.platform_url}\`\`\``, inline: false },
                        { name: 'Additional Information', value: `\`\`\`${formData.additional}\`\`\``, inline: false }
                    );
                    break;
                case 'other':
                    embed.addFields(
                        { name: 'RSN', value: `\`\`\`${formData.rsn}\`\`\``, inline: false },
                        { name: 'How can we assist?', value: `\`\`\`${formData.assistance}\`\`\``, inline: false }
                    );
                    break;
            }

            // Create close button
            const closeButton = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Secondary)
                );

            await channel.send({ content: welcomeMessage, embeds: [embed], components: [closeButton] });

            this.client.logger.log({
                message: `Sent welcome message to ticket channel: ${channel.name}`,
                handler: 'UtilityHandler'
            }, true);
        } catch (error) {
            this.client.logger.error({
                message: `Failed to send welcome message to ticket channel: ${channel.name}`,
                error,
                handler: 'UtilityHandler'
            });
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
