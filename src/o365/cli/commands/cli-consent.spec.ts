import commands from '../commands';
import globalCommands from '../../commands/commands';
import Command, { CommandOption, CommandValidate } from '../../../Command';
import * as sinon from 'sinon';
import appInsights from '../../../appInsights';
const command: Command = require('./cli-consent');
import * as assert from 'assert';
import Utils from '../../../Utils';
import config from '../../../config';

describe(commands.CONSENT, () => {
  let vorpal: Vorpal;
  let log: any[];
  let cmdInstance: any;
  let cmdInstanceLogSpy: any;
  let originalTenant: string;
  let originalAadAppId: string;

  before(() => {
    sinon.stub(appInsights, 'trackEvent').callsFake(() => {});
    originalTenant = config.tenant;
    originalAadAppId = config.cliAadAppId;
  });

  beforeEach(() => {
    vorpal = require('../../../vorpal-init');
    log = [];
    cmdInstance = {
      commandWrapper: {
        command: command.name
      },
      action: command.action(),
      log: (msg: any) => {
        log.push(msg);
      }
    };
    cmdInstanceLogSpy = sinon.spy(cmdInstance, 'log');
  });

  afterEach(() => {
    Utils.restore(vorpal.find);
    config.tenant = originalTenant;
    config.cliAadAppId = originalAadAppId;
  });

  after(() => {
    Utils.restore([
      appInsights.trackEvent
    ]);
  });

  it('has correct name', () => {
    assert.equal(command.name.startsWith(commands.CONSENT), true);
  });

  it('has a description', () => {
    assert.notEqual(command.description, null);
  });

  it('defines alias', () => {
    const alias = command.alias();
    assert.notEqual(typeof alias, 'undefined');
  });

  it('defines correct alias', () => {
    const alias = command.alias();
    assert.equal((alias && alias.indexOf(globalCommands.CONSENT) > -1), true);
  });

  it('shows consent URL for yammer permissions for the default multi-tenant app', (done) => {
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { service: 'yammer' } }, () => {
      try {
        assert(cmdInstanceLogSpy.calledWith(`To consent permissions for executing yammer commands, navigate in your web browser to https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=31359c7f-bd7e-475c-86db-fdb8c937548e&response_type=code&scope=https%3A%2F%2Fapi.yammer.com%2Fuser_impersonation`));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('shows consent URL for yammer permissions for a custom single-tenant app', (done) => {
    config.tenant = 'fb5cb38f-ecdb-4c6a-a93b-b8cfd56b4a89';
    config.cliAadAppId = '2587b55d-a41e-436d-bb1d-6223eb185dd4';
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { service: 'yammer' } }, () => {
      try {
        assert(cmdInstanceLogSpy.calledWith(`To consent permissions for executing yammer commands, navigate in your web browser to https://login.microsoftonline.com/fb5cb38f-ecdb-4c6a-a93b-b8cfd56b4a89/oauth2/v2.0/authorize?client_id=2587b55d-a41e-436d-bb1d-6223eb185dd4&response_type=code&scope=https%3A%2F%2Fapi.yammer.com%2Fuser_impersonation`));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('supports specifying service', () => {
    const options = (command.options() as CommandOption[]);
    let containsOption = false;
    options.forEach(o => {
      if (o.option.indexOf('--service') > -1) {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('fails validation if service is not specified', () => {
    const actual = (command.validate() as CommandValidate)({ options: { } });
    assert.notEqual(actual, true);
  });

  it('fails validation if specified service is invalid ', () => {
    const actual = (command.validate() as CommandValidate)({ options: { service: 'invalid' } });
    assert.notEqual(actual, true);
  });

  it('passes validation if service is set to yammer ', () => {
    const actual = (command.validate() as CommandValidate)({ options: { service: 'yammer' } });
    assert.equal(actual, true);
  });

  it('has help referring to the right command', () => {
    const cmd: any = {
      log: (msg: string) => { },
      prompt: () => { },
      helpInformation: () => { }
    };
    const find = sinon.stub(vorpal, 'find').callsFake(() => cmd);
    cmd.help = command.help();
    cmd.help({}, () => { });
    assert(find.calledWith(commands.CONSENT));
  });

  it('has help with examples', () => {
    const _log: string[] = [];
    const cmd: any = {
      log: (msg: string) => {
        _log.push(msg);
      },
      prompt: () => { },
      helpInformation: () => { }
    };
    sinon.stub(vorpal, 'find').callsFake(() => cmd);
    cmd.help = command.help();
    cmd.help({}, () => { });
    let containsExamples: boolean = false;
    _log.forEach(l => {
      if (l && l.indexOf('Examples:') > -1) {
        containsExamples = true;
      }
    });
    Utils.restore(vorpal.find);
    assert(containsExamples);
  });
});