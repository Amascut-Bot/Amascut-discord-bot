export interface Channels {
    [channelName: string]: string;
}

export interface Roles {
    [roleName: string]: string;
}

export function getChannels(guildId: string | undefined): Channels {
    let result = {} as Channels;

    //AGOD Bot Testing (Patze)
    if (guildId === '1391860635347849367') {
        result = {
            contentCreators: '1391860639063871581',
            achievements: '1391860638577594528',
            roleAssignLogs: '1391860640674484227',
            tempVCCategory: '1391860639584096317',
            tempVCCreate: '1391860639584096318',
            afkVC: '1391860639584096319',
            godLogs: '1391860641916260488',
            godImageStorage: '1391860641916260488',
            tickets: '1397705706358050948',
            cutePets: '1391860639063871579',
            reactionRoleLog: '1391860640674484228',
            admin: '1391860637369372764',
            leaderboardSubmission: '1401295942027841686',
            hallOfFame: '1401296432916467847',
            casualTeams: '1391860639584096316',
            trialedTeams: '1495724268041011383',
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
            trialee500TicketsCategory: '1412871767932010547',
            trialee1000TicketsCategory: '1412871767932010547',
            trialee2000TicketsCategory: '1412871767932010547',
            vouchTicketsCategory: `1464678728410992844`,
            vouchreportLogs: '1485240645340889128',
            reportLogs: '1391860639063871583',
            vodSubmissions: `1464589392843767860`,
            vodReview: `1464589425932632155`,
            masterTrialee1000TicketsCategory: '1492216896852988026',
            masterTrialee2000TicketsCategory: '1492216981972058122'
        }
    }

    //Amascut, Goddess of Destruction
    if (guildId === '885457551397912596') {
        result = {
            // no category

            // open tickets
            ticketCategory: '1404278113784823849',

            // work in progress tickets
            wipTicketCategory: '1404834663339528362',

            // helper applications
            staffTicketsCategory: '1416098705127375068',

            // admin chats
            admin: '1389379617915408448',

            // admin stuff
            tickets: '1390801555724308591',

            // important

            // information
            hallOfFame: '1401296202116501544',
            vodSubmissions: '1466832311629906015',
            trialApplications: '1389392070820630611',

            // community
            achievements: '1389393398829682739',
            cutePets: '1389643125408010290',
            contentCreators: '1390391961172836494',

            // learner tickets
            learnerTicketsCategory: '1412878315395481782',

            // lore book crew tickets
            lorebookTicketsCategory: '1439305836873777333',

            // learners corner
            learnerCategory: '1404510300715356232',
            learnerTempVCCreate: '1405678891565187112',
            learnerWaiting: '1405668159922503810',
            learnerTeaching: '1405338959063814227',
            learnerHosts: '1411429884571422922',
            teachersChat: '1404510586536202453',

            // trialee tickets
            trialee500TicketsCategory: '1464336828206415923',
            trialee1000TicketsCategory: '1483844686467563530',
            trialee2000TicketsCategory: '1483844787357614210',
            masterTrialee1000TicketsCategory: '1491863628649861220',
            masterTrialee2000TicketsCategory: '1491863719624577136',

            // trial team
            trialCategory: '1416026683659780148',
            trialHosts: '1441933810873667734',
            trialLounge: '1416027312369172481',
            vodReview: '1416026842753798276',

            // vouch tickets
            vouchTicketsCategory: '1484592041647407134',
            vouchreportLogs: '1485234144102449173',

            // guides
            guides: '1389410242210693212',

            // teamforming
            casualTeams: '1413114658541539410',
            trialedTeams: '1401385848993222866',
            splitsOnly: '1403494299903066142',
            combatAchievements: '1422202006793097328',

            // voice channels
            tempVCCategory: '885457551397912598',
            tempVCCreate: '1389392880518566138',
            afkVC: '1389391295130374237',

            // editor hub
            editorHub: '1389394110686953472',

            // logs
            roleAssignLogs: '1402724855287255070',
            godLogs: '1389412380626255872',
            godImageStorage: '1389417236367933470',
            reactionRoleLog: '1389413228794216648',
            autoBanLogs: '1445441478318096598',
            reportLogs: '1402724855287255070',

            // the archives
            leaderboardSubmission: '1401295523020935218',

            // thersguy event (archived)

            // event waiting area (archived)

            // storage
        }
    }

    return result;
}

export function getRoles(guildId: string | undefined, stripRole: boolean = false): Roles {
    let result = {} as Roles;

    //AGOD Bot Testing (Patze)
    if (guildId === '1391860635347849367') {
        result = {
            // Staff Roles
            owner: '1391860635507363886',
            admin: '1391860635507363883',
            trialTeam: '1391860635347849375',
            reportPerms: '1494342284207063130',
            vouchTeam: '1484617729515323596',
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
            elite2000trialee: '1468296795879772183',
            elite1000trialee: '1468296820319981568',
            elite500trialee: '1468296846488375472',

            master: '1492215560652591124',
            master2000: '1492215768388210749',
            master1000: '1492215806120169502',
            master2000trialee: '1492215881726562364',
            master1000trialee: '1492215850726592541',

            // Notify Roles
            notifyElite2000: '1492216554279141387',
            notifyElite1000: '1492216530174218485',
            notifyElite500: '1492216496045166744',
            notifyMaster2000: '1492215943340757154',
            notifyMaster1000: '1492215963758756062',

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
            devoured: '1488094862128447588',
            tumekensLight: '1488094722651328613',
            kspeedster: '1496408190017863680',

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
            trialTeam: '1436786514922311831',
            reportPerms: '1494316015415328778',
            vouchTeam: '1484617729515323596',
            teacher: '1412881470673916077',
            helperLearner: '1404509333185892422',
            lorebook: '1405001670101827617',
            editor: '1389397640533250058',

            CONTENT_CREATOR_ROLE: '1390007451482587216',
            LIVE_ROLE: '1390396115148476426',
            TWITCH_NOTIFICATION_ROLE: '1390408053114933381',
            MEOW_ROLE: '1390696959630774302',
            serverAnnouncements: '1389424960359104583',
            goodMorning: '1389635797992341567',
            member: '1389655724946100345',
            teamformingTimeout: '1404882562190413824',
            honeypot: '1445441207298953287',
            gatekeeper: '1445823416698540054',

            // Trialed Roles
            elite: '1462534403589800200',
            elite2000: '1462529648326869184',
            elite1000: '1462529561551175844',
            elite500: '1462529277198205216',
            elite2000trialee: '1468293818884558981',
            elite1000trialee: '1468293781513175082',
            elite500trialee: '1468293751461122303',

            master: '1485117983046238220',
            master2000: '1489788387870380202',
            master1000: '1489788305313890364',
            master2000trialee: '1491553995083223162',
            master1000trialee: '1491553904155164743',

            // Notify Roles
            notifyElite2000: '1462531083135357031',
            notifyElite1000: '1462531053230227699',
            notifyElite500: '1462531007382028288',
            notifyMaster2000: '1489811960479613049',
            notifyMaster1000: '1489811866552107058',

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
            devoured: '1487808817193549854',
            tumekensLight: '1487809205980238017',
            kspeedster: '1495123505094852679',

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
