import * as config from '../../config.json';
import { EmbedBuilder, ChatInputCommandInteraction, Interaction, APIEmbedField } from 'discord.js';
import Bot from '../Bot';
import { Override } from '../entity/Override';

export default interface UtilityHandler {
    client: Bot;
    config: typeof config;
    random(array: Array<any>): Array<number>;
    loadingEmbed: EmbedBuilder;
    loadingText: string;
}

interface Channels {
    [channelName: string]: string;
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
    matchmaking: MatchmakingCategory
}

interface MatchmakingCategory {
    threeSeven: string[]
    duo: string[]
    combined: string[]
}

export default class UtilityHandler {
    constructor(client: Bot) {
        this.client = client;
        this.config = config;
        this.random = (array) => array[Math.floor(Math.random() * array.length)];
        this.deleteMessage = this.deleteMessage;
        this.loadingEmbed = new EmbedBuilder().setAuthor({ name: 'Loading...' });
        this.loadingText = '<a:Typing:598682375303593985> **Loading...**';
    }

    get colours() {
        return {
            green: 2067276,
            aqua: 1146986,
            blue: 2123412,
            red: 10038562,
            lightgrey: 10070709,
            gold: 12745742,
            default: 5198940,
            lightblue: 302332,
            darkgrey: 333333,
            tan: 10588508, // Reaper
            darkPurple: 7157747, // Trial Team
            discord: {
                green: 5763719,
                red: 15548997
            }
        }
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
                roleConfirmations: '1043923758781571126',
                achievementsAndLogs: '1043923759280697405',
                botRoleLog: '1044636757808922766',
                reportLog: '1047434337647329330',
                tempVCCategory: '1043923758781571128',
                tempVCCreate: '1044828975106641920',
                dpmCalc: '1043923759280697406',
                trialScheduling: '1051512803485286481',
                reaperScheduling: '1043923759763034194',
                reaperSquad: '1043923759763034197',
            }
        }
        return {
            roleConfirmations: '846853673476685824',
            achievementsAndLogs: '429378540115329044',
            botRoleLog: '1045192967754883172',
            reportLog: '1046699857433342103',
            tempVCCategory: '429001601089536007',
            tempVCCreate: '934588464068968479',
            dpmCalc: '927485855625515039',
            trialScheduling: '1050019465993142412',
            reaperScheduling: '1079703262040707164',
            reaperSquad: '922046772958859274',
        }
    }

    get dpm() {
        return {
            'initiate': 300,
            'adept': 400,
            'mastery': 475,
            'extreme': 590
        }
    }

    get roles(): Roles {
        if (process.env.ENVIRONMENT === 'DEVELOPMENT') {
            return {
                duoMaster: '<@&1043923757732999218>',
                threeSevenMaster: '<@&1043923757707829449>',
                master: '<@&1043923757732999219>',
                solakAddict: '<@&1043923757665890440>',
                trialTeam: '<@&1043923757783326780>',
                admin: '<@&1043923757783326788>',
                owner: '<@&1043923757783326789>',
                duoRootskips: '<@&1043923757707829443>',
                threeSevenRootskips: '<@&1043923757707829442>',
                rootskips: '<@&1043923757707829444>',
                noRealm: '<@&1043923757707829441>',
                duoExperienced: '<@&1043923757707829446>',
                threeSevenExperienced: '<@&1043923757707829445>',
                experienced: '<@&1043923757707829447>',
                duoGrandmaster: '<@&1043923757732999225>',
                threeSevenGrandmaster: '<@&1043923757732999224>',
                fours: '<@&1077211897931235339>',
                grandmaster: '<@&1043923757732999226>',
                erethdorsBane: '<@&1043923757758156862>',
                solakRookie: '<@&1043923757665890437>',
                solakCasual: '<@&1043923757665890438>',
                solakEnthusiast: '<@&1043923757665890439>',
                unlockedPerdita: '<@&1043923757665890441>',
                solakFanatic: '<@&1043923757665890442>',
                solakSlave: '<@&1043923757665890443>',
                solakSimp: '<@&1044291432531369994>',
                solakLegend: '<@&1044291464898822204>',
                nightOutWithMyRightHand: '<@&1043923757619744831>',
                probablyUsesSpecialScissors: '<@&1043923757619744830>',
                oneForTheBooks: '<@&1043923757619744829>',
                brokenPrinter: '<@&1043923757619744828>',
                merethielsSimp: '<@&1043923757598781470>',
                shroomDealer: '<@&1043923757598781469>',
                verifiedLearner: '<@&1043923757707829440>',
                solakWRHolder: '<@&1043923757732999223>',
                guardianOfTheGrove: '<@&1043923757691047936>',
                initiate: '<@&1043923757691047943>',
                adept: '<@&1043923757691047945>',
                mastery: '<@&1043923757691047944>',
                extreme: '<@&1043923757732999222>',
                moderator: '<@&1050759587898339409>',
                notifyExperienced: '<@&1077221105498066974>',
                notifyMaster: '<@&1077221066587512852>',
                notifyGM: '<@&1077221033322500096>',
                notify4s: '<@&1077228261131698316>',
                teacher: '<@&1043923757758156867>',
                reaper: '<@&1043923757758156866>',
            }
        }
        return {
            duoMaster: '<@&1074344442355535872>',
            threeSevenMaster: '<@&1119368648482623559>',
            master: '<@&1119368608116641873>',
            solakAddict: '<@&553715068273950751>',
            trialTeam: '<@&488073429975826452>',
            admin: '<@&519490446368571392>',
            owner: '<@&553738397848698882>',
            duoRootskips: '<@&1007584848719912973>',
            threeSevenRootskips: '<@&931903313144848394>',
            rootskips: '<@&1037493398220841060>',
            noRealm: '<@&931903143279755306>',
            duoExperienced: '<@&931903449396834364>',
            threeSevenExperienced: '<@&981579337159565383>',
            experienced: '<@&981581909387800586>',
            duoGrandmaster: '<@&1119368333129691177>',
            threeSevenGrandmaster: '<@&1119368483608727703>',
            fours: '<@&1074344307068252210>',
            grandmaster: '<@&1119365076743360674>',
            erethdorsBane: '<@&793913994980491344>',
            solakRookie: '<@&553714327740481536>',
            solakCasual: '<@&553714447231877130>',
            solakEnthusiast: '<@&553714570145955892>',
            unlockedPerdita: '<@&493153184995606558>',
            solakFanatic: '<@&553716549593202732>',
            solakSlave: '<@&932238504958771201>',
            solakSimp: '<@&1038562094112587887>',
            solakLegend: '<@&1038562124311564420>',
            nightOutWithMyRightHand: '<@&862278802083676181>',
            probablyUsesSpecialScissors: '<@&862278416060514314>',
            oneForTheBooks: '<@&858689534300389416>',
            brokenPrinter: '<@&858690604656885770>',
            merethielsSimp: '<@&862276498098749440>',
            shroomDealer: '<@&862276579727114250>',
            verifiedLearner: '<@&935257969552142339>',
            solakWRHolder: '<@&926057875367952394>',
            guardianOfTheGrove: '<@&452531368132345866>',
            initiate: '<@&927278371862380575>',
            adept: '<@&927278601735397427>',
            mastery: '<@&927278888403480668>',
            extreme: '<@&793847049841279007>',
            moderator: '<@&1050111253185568788>',
            notifyExperienced: '<@&1070733909119209512>',
            notifyMaster: '<@&1070734914716172390>',
            notifyGM: '<@&1070734957426786324>',
            notify4s: '<@&1077226312277692466>',
            teacher: '<@&782012576279429174>',
            reaper: '<@&922061359926104095>',
        }
    }

    get categories(): Categories {
        return {
            killCount: ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic', 'solakSlave', 'solakSimp', 'solakLegend'],
            collectionLog: ['nightOutWithMyRightHand', 'probablyUsesSpecialScissors', 'oneForTheBooks', 'brokenPrinter', 'merethielsSimp', 'shroomDealer', 'guardianOfTheGrove'],
            matchmaking: {
                threeSeven: ['noRealm', 'threeSevenRootskips', 'threeSevenExperienced', 'threeSevenMaster', 'threeSevenGrandmaster'],
                duo: ['duoRootskips', 'duoExperienced', 'duoMaster', 'duoGrandmaster'],
                combined: ['rootskips', 'experienced', 'master', 'grandmaster']
            }
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
        } else if (this.categories.matchmaking.threeSeven.includes(role)) {
            category = 'threeSeven';
        } else if (this.categories.matchmaking.duo.includes(role)) {
            category = 'duo';
        } else if (this.categories.matchmaking.combined.includes(role)) {
            category = 'combined';
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
        } else if (overrides.roleConfirmations.includes(role) || this.categories.matchmaking.combined.includes(role) || this.categories.matchmaking.duo.includes(role) || this.categories.matchmaking.threeSeven.includes(role)) {
            return 'roleConfirmations'
        } else {
            return ''
        }
    }

    public hasRolePermissions = async (client: Bot, roleList: string[], interaction: Interaction) => {
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
        for (const player of players) {
            if (player.value === '`Empty`') {
                return false;
            }
        }
        return true;
    }
}
