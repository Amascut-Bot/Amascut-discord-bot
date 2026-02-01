export interface Channels {
    [channelName: string]: string;
}

export interface Roles {
    [roleName: string]: string;
}

export function getChannels(guildId: string | undefined) : Channels {
    let result = {} as Channels;

    //AGOD Bot Testing (Patze)
    if (guildId === '1391860635347849367') {
        result = {
            TWITCH_NOTIFICATION_CHANNEL: '1391860639063871581',
            roleConfirmations: '1391860638577594521',
            achievementsAndLogs: '1391860638577594528',
            botRoleLog: '1391860640674484227',
            reportLog: '1391860641316343983',
            tempVCCategory: '1391860639584096317',
            tempVCCategory2: '1391860639584096317',
            tempVCCategory3: '1391860639584096317',
            tempVCCreate: '1391860639584096318',
            afkVC: '1391860639584096319',
            uploadLogChannel: '1391860641916260488',
            botAssetChannel: '1391860641916260488',
            TICKET_TRANSCRIPT_CHANNEL: '1397705706358050948',
            VOUCH_TRANSCRIPT_CHANNEL: `1464685914637734103`,
            MUSIC_CHANNEL: '1399769752246816841',
            CUTE_PETS_CHANNEL: '1391860639063871579',
            LOG_CHANNEL_ID: '1391860640674484228',
            ADMIN_CHANNEL: '1391860637369372764',
            leaderboardSubmission: '1401295942027841686',
            leaderboards: '1401296432916467847',
            casualTeams: '1391860639584096316',
            trialedTeams: '1391860639584096316',
            keepsOnly: '1391860639584096316',
            combatAchievements: '1391860639584096316',
            ticketCategory: '1404433490266816632',
            wipTicketCategory: '1415020430867304480',
            learnerCategory: '1405663718875861052',
            learnerTempVCCreate: '1405664879075004596',
            learnerWaiting: '1405671688514965615',
            learnerTeaching: '1405671729959014460',
            learnerTicketsCategory: '1412871767932010547',
            learnerHosts: '1411662134756118569',
            staffTicketsCategory: '1415817949868068976',
            teachersChat: '1405664850469847122',
            lorebookTicketsCategory: '1412871767932010547',
            trialHosts: '1411662134756118569',
            trialLounge: '1405664850469847122',
            autoBanLogs: '1450965697378386115',
            trialeeTicketsCategory: '1412871767932010547',
            vouchTicketsCategory: `1464678728410992844`,
            vodSubmissions: `1464589392843767860`,
            vodReview: `1464589425932632155`
        }
    }

    //Amascut, Goddess of Destruction
    if (guildId === '885457551397912596') {
        result = {
            TWITCH_NOTIFICATION_CHANNEL: '1390391961172836494',
            roleConfirmations: '1389393398829682739', //'1389392006891045116',
            achievementsAndLogs: '1389393398829682739',
            botRoleLog: '1402724855287255070',
            reportLog: '1389416667393556640',
            tempVCCategory: '885457551397912598',
            tempVCCategory2: '1402375561887748216',
            tempVCCategory3: '1403384312782389400',
            tempVCCreate: '1389392880518566138',
            afkVC: '1389391295130374237',
            uploadLogChannel: '1389412380626255872',
            botAssetChannel: '1389417236367933470',
            TICKET_TRANSCRIPT_CHANNEL: '1390801555724308591',
            MUSIC_CHANNEL: '1393623447212527769',
            CUTE_PETS_CHANNEL: '1389643125408010290',
            LOG_CHANNEL_ID: '1389413228794216648',
            ADMIN_CHANNEL: '1389379617915408448',
            leaderboardSubmission: '1401295523020935218',
            leaderboards: '1401296202116501544',
            casualTeams: '1403494299903066142',
            trialedTeams: '1401385848993222866',
            keepsOnly: '1413114658541539410',
            combatAchievements: '1422202006793097328',
            ticketCategory: '1404278113784823849',
            wipTicketCategory: '1404834663339528362',
            staffTicketsCategory: '1416098705127375068',
            // Learner Section Channels
            lorebookTicketsCategory: '1439305836873777333',
            learnerTicketsCategory: '1412878315395481782',
            learnerCategory: '1404510300715356232',
            learnerTempVCCreate: '1405678891565187112',
            learnerWaiting: '1405668159922503810',
            learnerTeaching: '1405338959063814227',
            learnerHosts: '1411429884571422922',
            teachersChat: '1404510586536202453',
            // Trial Team Channels
            trialCategory: '1416026683659780148',
            trialHosts: '1441933810873667734',
            trialApplications: '1389392070820630611',
            trialLounge: '1416027312369172481',
            vodSubmissions: '1466832311629906015',
            vodReview: '1416026842753798276',
            trialeeTicketsCategory: '1464336828206415923',
            // Staging Guide Category
            stagingEditorHub: '1389394110686953472',
            // Prod Guide Category
            editorHub: '1389410242210693212',

            // Log Channels
            autoBanLogs: '1445441478318096598',
        }
    }

    return result;
}

export function getRoles(guildId: string | undefined, stripRole: boolean = false) : Roles {
    let result = {} as Roles;

    //AGOD Bot Testing (Patze)
    if (guildId === '1391860635347849367') {
        result = {
            // Staff Roles
            owner: '1391860635507363886',
            admin: '1391860635507363883',
            trialTeam: '1391860635347849375',
            trialTeamTryout: '1391860635347849375',
            reaper: '1391860635347849374',
            teacher: '1412871872374116463',
            helperLearner: '1412871872374116463',
            lorebook: '1441892735144558776',

            CONTENT_CREATOR_ROLE: '1391860635456901393',
            LIVE_ROLE: '1391860635456901398',
            TWITCH_NOTIFICATION_ROLE: '1391860635347849376',
            MEOW_ROLE: '1391860635456901395',
            serverAnnouncements: '000000000000000000',
            goodMorning: '000000000000000000',
            member: '1391860635406700566',
            teamformingTimeout: '1405236128294109224',
            devourerFirstWeek: '1401274911594647626',
            devourerDayOne: '1401274865113370685',
            honeypot: '1445441207298953287',
            gatekeeper: '1445823416698540054',

            // Trialed Roles
            elite: '1464337843651608696',
            elite2000: '1464337925524160738',
            elite1000: '1464337906159190016',
            elite500: '1464337875503022135',

            // KC Roles
            kc100: '1409628812915904652', // Cat-Bound Initiate
            kc250: '1409628840287801385', // Scarab-Marked Disciple
            kc500: '1409628927080665189', // Whisperer of the Wanderer
            kc750: '1409628969837400075', // Bearer of the Unholy Sigil
            kc1000: '1409628992880771083', // Fang of the Devourer
            kc1500: '1416694159883898951', // Seeker of the Kharid-ib
            kc2000: '1416694240792285204', // Echo of Mah's Madness
            kc3000: '1416694269103702078', // Oracle of the Hollow Sun
            kc5000: '1416694297482231878', // Herald of the Scarab Paraoh
            kc7500: '1416694341203660830', // Soul-Eater Ascendant
            kc10000: '1416694373462310943', // Eternal Fang of the Devourer

            // Collection Log Roles
            silverSpoon: '1401274832284553226',
            goldenSpoon: '1401274807085039791',
            visionmaker: '1409629419059937442',
            mask5: '1409629498806108273',
            top5: '1401431461156098070',
            bottom5: '1409629534101442720',
            gloves5: '1409629565629890690',
            boots5: '1409629595736608776',
            guard5: '1409629629521858681',
            light5: '1409629706218766358',
            pet: '1409629724732293293',

            // Enrage Roles
            enr500: '1404800709462982716',
            enr1000: '1404800755436748840',
            enr2000: '1404800783798501396',
            enr4000: '000000000000000000',
            rd500: '1401274362987810907',
            rd1000: '1401274388187447429',
            rd2000: '1401274406369755187',
            rd4000: '1401274424220450838',
            rw500: '000000000000000000',
            rw1000: '000000000000000000',
            rw2000: '1401274458852950140',
            rw4000: '1401274490910146682',
            firstDevourer: '000000000000000000',
        }
    }

    //Amascut, Goddess of Destruction
    if (guildId === '885457551397912596') {
        result = {
            // Staff Roles
            owner: '1389387255386341386',
            admin: '1389526658167603230',
            trialTeam: '1390444778738684065',
            trialTeamTryout: '1436750954585264380',
            reaper: '1390444833537130568',
            teacher: '1412881470673916077',
            helperLearner: '1404509333185892422',
            lorebook: '1405001670101827617',
            editor: '1389397640533250058',

            nitroBooster: '000000000000000000',
            CONTENT_CREATOR_ROLE: '1390007451482587216',
            LIVE_ROLE: '1390396115148476426',
            TWITCH_NOTIFICATION_ROLE: '1390408053114933381',
            MEOW_ROLE: '1390696959630774302',
            serverAnnouncements: '000000000000000000',
            goodMorning: '000000000000000000',
            member: '1389655724946100345',
            teamformingTimeout: '1404882562190413824',
            honeypot: '1445441207298953287',
            gatekeeper: '1445823416698540054',

            // Trialed Roles
            elite: '1462534403589800200',
            elite2000: '1462529648326869184',
            elite1000: '1462529561551175844',
            elite500: '1462529277198205216',

            // KC Roles
            kc100: '1401429471692722292', // Cat-Bound Initiate
            kc250: '1401429722704904313', // Scarab-Marked Disciple
            kc500: '1401429855731449948', // Whisperer of the Wanderer
            kc750: '1401429929341485056', // Bearer of the Unholy Sigil
            kc1000: '1401430017367343106', // Fang of the Devourer
            kc1500: '1401430067568967761', // Seeker of the Kharid-ib
            kc2000: '1401430113547063390', // Echo of Mah's Madness
            kc3000: '1401430169440227338', // Oracle of the Hollow Sun
            kc5000: '1401430224079687751', // Herald of the Scarab Paraoh
            kc7500: '1401430309328650310', // Soul-Eater Ascendant
            kc10000: '1401430358443950132', // Eternal Fang of the Devourer

            // Collection Log Roles
            silverSpoon: '1400869056445415594',
            goldenSpoon: '1400869015940759662',
            visionmaker: '1401431808096342026',
            mask5: '1401431409620422677',
            top5: '1401431461156098070',
            bottom5: '1401431508996067378',
            gloves5: '1401431599777583327',
            boots5: '1401431554906914957',
            guard5: '1401431662327369780',
            light5: '1401431760704901193',
            pet: '1401431834780241940',
            nexus5: '1416532184851808316',

            // Enrage Roles
            enr500: '1401450408492404877',
            enr1000: '1401450459256066141',
            enr2000: '1401450500481749062',
            enr4000: '1401450529959313428',
            rd500: '1400868489048359086',
            rd1000: '1400868543653744670',
            rd2000: '1400868598376960130',
            rd4000: '1400868619449139412',
            rw500: '1402610603268374548',
            rw1000: '1402610645328986152',
            rw2000: '1400868680522534933',
            rw4000: '1400868744045002963',
            firstDevourer: '1400868959833690152',
        }
    }

    return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, stripRole ? value : `<@&${value}>`]));
}
