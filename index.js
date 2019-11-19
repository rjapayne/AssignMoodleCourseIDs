const puppeteer = require('puppeteer');
var async = require('async');
var fs = require('fs-extra');
var request = require('request-promise');

const fileSource = 'studentclassenrolments.csv';
const username = 'USERNAME';
const pass = 'PASSWORD';
var testingScript = false;

/*THIS SCRIPT IS FOR BATCH PERFORMING THE TASK OF CRAWLING THROUGH MOODLE AND ASSIGNING THE SCHOOL PRO ID NUMBERS TO "Course ID number"
page: https://MOODLE_DOMAIN/course/edit.php?id=0000000*/
var enrolDict = [];
var doneIDs = [];
var errorList = [];
var uploadFail = false;

//Read New IDs File
fs.readFile(fileSource, function(err, data) {
	if(err) throw err;
	var enrolFile = data.toString().split("\r");
	var headerRow = enrolFile[0].split(",");
	var loopOne = true;
	async.each(enrolFile, function(row,callback){
		if (!loopOne){
			var pushrow = [];
			var rowBreakDown = row.split(",");
			var counter = 0;
			for (var item in rowBreakDown){
				var headertext = headerRow[counter];
				var inputItem = rowBreakDown[item];
				pushrow[headertext]=inputItem;
				counter++;
			}
			if(doneIDs[pushrow['Sub_ID']] == undefined && pushrow['school_num'] != ''){
				enrolDict.push(pushrow);
				doneIDs[pushrow['Sub_ID']] = pushrow;
				console.log(doneIDs[pushrow['Sub_ID']]);
			}
			callback();
		}else{
			loopOne = false;
			callback();
		}
	},function(err){
		console.log(enrolDict.length);
		loginAndUpload();
	});
});

async function loginAndUpload() {
	try {
		var baseSiteP = '';
		if (testingScript)
			baseSiteP = 'https://MOODLE_DEV_SITE';
		else
			baseSiteP = 'https://MOODLE_PRODUCTION_SITE';
		
		const loginP = baseSiteP+'/login/';	
		const coursesP = baseSiteP+'/course/';
		const baseCourseP = baseSiteP+'/course/view.php?name=';
		const baseEditP = baseSiteP+'/course/edit.php?id=';	
		const browser = await puppeteer.launch({headless:!testingScript});
		const page = await browser.newPage();
		
		//LOGIN CODE
		await page.goto(loginP);
		await page.type('#username', username);
		await page.type('#password', pass);
		await page.click('#loginbtn');
		await page.waitFor(1000);
		
		//BEGIN LOOP
		for(var course in enrolDict){
			var currentShortName = enrolDict[course]['SubName_Short'];
			var currentSPIdNum = enrolDict[course]['Sub_ID'];
			console.log("Start "+enrolDict[course]['SubName_Short']+" "+enrolDict[course]['Sub_ID']);
			var newPageP = baseCourseP+currentShortName;
			await page.goto(newPageP);
			await page.waitFor(1000);
			const bredData = await page.evaluate(() => {
				const tds = Array.from(document.querySelectorAll('.breadcrumb a'));
				return tds.map(td => td.href);
			});
			var url4id = bredData[bredData.length-1];
			var courseID = url4id.substring(url4id.indexOf("=")+1,url4id.length);
			var customEditP = baseEditP + courseID;
			await page.goto(customEditP);
			
			//Enter code (clears any existing value before entering)
			if (await page.$(".errorbox") == null){
				await page.evaluate(() => {document.querySelector('#id_idnumber').value = ''});
				await page.type('#id_idnumber', currentSPIdNum);
				await page.waitFor(2000);
				await page.click('#id_saveanddisplay');
				await page.waitForNavigation();
			}else{
				console.log("Course Not Found!");
			}
		}
		//END LOOP
		await browser.close();
	} catch(error) {
		console.log(error);
		errorList.push(error);
		uploadFail = true;
	}
}