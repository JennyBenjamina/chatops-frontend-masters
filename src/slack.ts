import type { Handler } from '@netlify/functions';
import { parse } from 'querystring';
import { blocks, modal, slackApi, verifySlackRequest } from './util/slack';
import { saveItem } from './util/notion';

async function handleSlashCommand(payload: SlackSlashCommandPayload) {
  switch (payload.command) {
    case '/foodfight':
      // const joke = await fetch('https://icanhazdadjoke.com', {
      //   headers: {
      //     accept: 'text/plain',
      //   },
      // });
      // const response = await slackApi('chat.postMessage', {
      //   channel: payload.channel_id,
      //   text: await joke.text(),
      // });
      // console.log(payload.channel_id);
      const response = await slackApi(
        'views.open',
        modal({
          id: 'foodfight.modal',
          title: 'start a food fight',
          trigger_id: payload.trigger_id,
          blocks: [
            blocks.section({
              text: 'The discourse demands food drama! *Send in your spiciest food takes so we can all argue about them.*',
            }),
            blocks.input({
              id: 'opinion',
              label: 'Deposit your controversial opion here',
              placeholder:
                'Example: peanut butter and mayo sandwiches are delish',
              initial_value: payload.text ?? '',
              hint: 'what do you believe about food that people find appalling? Say it with your chest!',
            }),
            blocks.select({
              id: 'spice_level',
              label: 'how spicy is this opinion?',
              placeholder: 'Select a spice level',
              options: [
                { label: 'mild', value: 'mild' },
                { label: 'medium', value: 'medium' },
                { label: 'spicy', value: 'spicy' },
                { label: 'nuclear', value: 'nuclear' },
              ],
            }),
          ],
        })
      );

      if (!response.ok) {
        console.log(response);
      }

      break;

    default:
      return {
        statusCode: 200,
        body: `Command ${payload.command} not supported`,
      };
  }

  return {
    statusCode: 200,
    body: '',
  };
}

async function handleInteractivity(payload: SlackModalPayload) {
  const callback_id = payload.callback_id ?? payload.view.callback_id;
  switch (callback_id) {
    case 'foodfight.modal':
      const data = payload.view.state.values;
      const fields = {
        opinion: data.opinion_block.opinion.value,
        spiceLevel: data.spice_level_block.spice_level.selected_option.value,
        submitter: payload.user.name,
      };

      await saveItem(fields);

      try {
        const res = await slackApi('chat.postMessage', {
          channel: 'C05QHUHEHJA',
          text: `Oh dang, y'all ! :eyes: <@${payload.user.id}> just started a food fight with a ${fields.spiceLevel} take:\n\n*${fields.opinion}*\n\n...discuss`,
        });
      } catch (e) {
        console.log(e);
      }

      break;

    case 'start-food-fight-nudge':
      const channel = payload.channel?.id;
      const user_id = payload.user.id;
      const thread_ts = payload.message.thread_ts ?? payload.message.ts;

      await slackApi('chat.postMessage', {
        channel,
        thread_ts,
        text: `Hey <@${user_id}>, an opinion like this one deserves a heated public debate. Run the \`/foodfight\` slash command in a main channel to start one!`,
      });
      break;

    default:
      console.log(`no handler defined for ${callback_id}`);

      return {
        statusCode: 400,
        body: `no handler defined for ${callback_id}`,
      };
  }

  return {
    statusCode: 200,
    body: '',
  };
}

export const handler: Handler = async (event) => {
  // TODO validate the Slack request
  const valid = verifySlackRequest(event);

  if (!valid) {
    console.error('invalid request');

    return {
      statusCode: 400,
      body: 'invalid request',
    };
  }

  // TODO handle slash commands
  const body = parse(event.body ?? '') as SlackPayload;

  if (body.command) {
    return handleSlashCommand(body as SlackSlashCommandPayload);
  }

  // TODO handle interactivity (e.g. context commands, modals)
  if (body.payload) {
    const payload = JSON.parse(body.payload);
    const returnObject = await handleInteractivity(payload);
    return returnObject;
  }

  return {
    statusCode: 200,
    body: 'TODO: handle Slack commands and interactivity',
  };
};
