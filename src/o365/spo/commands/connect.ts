import auth from '../SpoAuth';
import { ContextInfo } from '../spo';
import Auth from '../../../Auth';
import config from '../../../config';
import * as request from 'request-promise-native';
import commands from '../commands';
import VerboseOption from '../../../VerboseOption';
import Command, {
  CommandCancel,
  CommandHelp,
  CommandValidate
} from '../../../Command';
import SpoCommand from '../SpoCommand';

const vorpal: Vorpal = require('../../../vorpal-init');

interface CommandArgs {
  url: string;
  options: VerboseOption;
}

const CONNECTION_SUCCEEDED: string = 'connection_succeeded';

class SpoConnectCommand extends Command {
  public get name(): string {
    return `${commands.CONNECT} <url>`;
  }

  public get description(): string {
    return 'Connects to a SharePoint Online site';
  }

  public commandAction(cmd: CommandInstance, args: CommandArgs, cb: () => void): void {
    const chalk: any = vorpal.chalk;

    // disconnect before re-connecting
    if (this.verbose) {
      cmd.log(`
Disconnecting from SPO...
`);
    }
    auth.site.disconnect();

    cmd.log(`
Authenticating with SharePoint Online at ${args.url}...
`);

    const resource = Auth.getResourceFromUrl(args.url);

    auth
      .ensureAccessToken(resource, cmd, args.options.verbose)
      .then((accessToken: string): Promise<ContextInfo> => {
        auth.service.resource = resource;
        auth.site.url = args.url;
        cmd.log(chalk.green('DONE'));

        if (this.verbose) {
          cmd.log(`Checking if ${auth.site.url} is a tenant admin site...`);
        }
        if (auth.site.isTenantAdminSite()) {
          const requestDigestRequestOptions: any = {
            url: `${auth.site.url}/_api/contextinfo`,
            headers: {
              authorization: `Bearer ${accessToken}`,
              accept: 'application/json;odata=nometadata'
            },
            json: true
          };

          if (this.verbose) {
            cmd.log(`${auth.site.url} is a tenant admin site. Get tenant information...`);
            cmd.log('');
            cmd.log('Executing web request:');
            cmd.log(requestDigestRequestOptions);
            cmd.log('');
          }

          return request.post(requestDigestRequestOptions);
        }
        else {
          if (this.verbose) {
            cmd.log(`${auth.site.url} is not a tenant admin site`);
            cmd.log('');
          }

          auth.site.connected = true;
          cmd.log(`Successfully connected to ${args.url}`);
          cb();
          throw CONNECTION_SUCCEEDED;
        }
      })
      .then((res: ContextInfo): Promise<string> => {
        if (this.verbose) {
          cmd.log('Response:');
          cmd.log(res);
          cmd.log('');
        }

        const tenantInfoRequestOptions = {
          url: `${auth.site.url}/_vti_bin/client.svc/ProcessQuery`,
          headers: {
            authorization: `Bearer ${auth.site.accessToken}`,
            'X-RequestDigest': res.FormDigestValue,
            accept: 'application/json;odata=nometadata'
          },
          body: `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="4" ObjectPathId="3" /><Query Id="5" ObjectPathId="3"><Query SelectAllProperties="true"><Properties /></Query></Query></Actions><ObjectPaths><Constructor Id="3" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}" /></ObjectPaths></Request>`
        };

        cmd.log('Retrieving tenant admin site information...');

        if (this.verbose) {
          cmd.log('Executing web request:');
          cmd.log(tenantInfoRequestOptions);
          cmd.log('');
        }

        return request.post(tenantInfoRequestOptions);
      })
      .then((res: string): void => {
        if (this.verbose) {
          cmd.log('Response:');
          cmd.log(res);
          cmd.log('');
        }

        const json: string[] = JSON.parse(res);

        auth.site.tenantId = (json[json.length - 1] as any)._ObjectIdentity_.replace('\n', '&#xA;');
        auth.site.connected = true;
        cmd.log(chalk.green('DONE'));
        cmd.log(`Successfully connected to ${args.url}
`);
        cb();
      }, (rej: Error | string): void => {
        if (rej instanceof Error) {
          if (this.verbose) {
            cmd.log('Error:');
            cmd.log(rej);
            cmd.log('');
          }

          cmd.log(chalk.red('Connecting to SharePoint Online failed'));
          cmd.log(`The following error occurred: ${rej.message}`);
          cb();
          return;
        }
        else {
          if (this.verbose) {
            cmd.log('Early exit of a promise chain');
          }
        }
      });
  }

  public validate(): CommandValidate {
    return (args: CommandArgs): boolean | string => {
      return SpoCommand.isValidSharePointUrl(args.url);
    };
  }

  public cancel(): CommandCancel {
    return (): void => {
      if (auth.interval) {
        clearInterval(auth.interval);
      }
    }
  }

  public help(): CommandHelp {
    return function (args: CommandArgs, log: (help: string) => void): void {
      const chalk = vorpal.chalk;
      log(vorpal.find(commands.CONNECT).helpInformation());
      log(
        `  Arguments:
    
    url  absolute URL of the SharePoint Online site to connect to
        
  Remarks:

    Using the ${chalk.blue(commands.CONNECT)} command, you can connect to any SharePoint Online site.
    Depending on the command you want to use, you might be required to connect
    to a SharePoint Online tenant admin site (suffixed with ${chalk.grey('-admin')},
    eg. ${chalk.grey('https://contoso-admin.sharepoint.com')}) or a regular site.

    The ${chalk.blue(commands.CONNECT)} command uses device code OAuth flow with the standard
    Microsoft SharePoint Online Management Shell Azure AD application to connect
    to SharePoint Online.
    
    When connecting to a SharePoint site, the ${chalk.blue(commands.CONNECT)} command stores in memory
    the access token and the refresh token for the specified site. Both tokens are cleared from memory
    after exiting the CLI or by calling the ${chalk.blue(commands.DISCONNECT)} command.

  Examples:
  
    ${chalk.grey(config.delimiter)} ${commands.CONNECT} https://contoso-admin.sharepoint.com
      connects to a SharePoint Online tenant admin site

    ${chalk.grey(config.delimiter)} ${commands.CONNECT} --verbose https://contoso-admin.sharepoint.com
      connects to a SharePoint Online tenant admin site in verbose mode including
      detailed debug information in the console output
      
    ${chalk.grey(config.delimiter)} ${commands.CONNECT} https://contoso.sharepoint.com/sites/team
      connects to a regular SharePoint Online site
`);
    }
  }
}

module.exports = new SpoConnectCommand();