<template>
  <v-dialog
    :key="subtitleUrl"
    v-model="dialog"
    @click:outside="dialog = false"
    max-width="800px"
    transition="dialog-bottom-transition"
    :fullscreen="$vuetify.breakpoint.smAndDown"
    scrollable
  >
    <v-card ref="dialogCard" class="tv-transcript-dialog" @keydown="onRemoteKeydown">
      <v-toolbar color="primary" dark class="flex-grow-0 tv-transcript-toolbar">
        <v-toolbar-title>Transcript</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-toolbar-items>
          <v-btn icon @click="onCopy">
            <v-icon>mdi-content-copy</v-icon>
          </v-btn>
          <v-btn icon @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar-items>
      </v-toolbar>

      <v-card-text class="pa-6 tv-transcript-body">
        <v-textarea
          :value="subtitles"
          outlined
          auto-grow
          autofocus
          hide-details
          readonly
        ></v-textarea>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import axios from 'axios';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Mutation, State } from 'vuex-class';
// @ts-ignore
import SpatialNavigation from 'js-spatial-navigation';
import { Language, Video } from '@/types';
import { isBackKey } from '@/utils/remote-navigation';

const SECTION_TRANSCRIPT = 'sn-transcript';
const SECTION_MAIN = 'sn-main';

@Component
export default class TranscriptDialog extends Vue {
  vtt: string | null = null;

  @State languages!: Language[];

  @State transcriptDialog!: boolean;
  @Mutation setTranscriptDialog!: (value: boolean) => void;

  @State subtitleMedia!: Video | null;

  // eslint-disable-next-line class-methods-use-this
  beforeDestroy() {
    SpatialNavigation.remove(SECTION_TRANSCRIPT);
  }

  get xsOnly() {
    return this.$vuetify.breakpoint.xsOnly;
  }

  get dialog() {
    return this.transcriptDialog;
  }

  set dialog(value) {
    this.setTranscriptDialog(value);
  }

  get subtitleUrl() {
    const found = this.subtitleMedia?.files.find((file) => file?.subtitles?.url !== undefined);
    if (found === undefined) return null;
    return found.subtitles.url;
  }

  onCopy() {
    navigator.clipboard.writeText(this.subtitles ?? '');
  }

  get dialogElement() {
    return this.$refs.dialogCard as HTMLElement | undefined;
  }

  get firstButton() {
    return this.dialogElement?.querySelector('button:not([disabled])') as HTMLElement | null;
  }

  onRemoteKeydown(event: KeyboardEvent) {
    // Handle back key to close dialog
    if (isBackKey(event)) {
      this.dialog = false;
      event.preventDefault();
      return;
    }

    // Spatial navigation handles navigation automatically
    if (event.key === 'Enter') {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement) {
        focused.click();
        event.preventDefault();
      }
    }
  }

  @Watch('transcriptDialog')
  onTranscriptDialogChange(isOpen: boolean) {
    if (!isOpen) {
      SpatialNavigation.remove(SECTION_TRANSCRIPT);
      SpatialNavigation.focus(SECTION_MAIN);
      return;
    }

    // Setup spatial nav for transcript dialog
    this.$nextTick(() => {
      const dialog = this.dialogElement;
      if (!dialog) return;

      SpatialNavigation.add(SECTION_TRANSCRIPT, {
        selector: '[tabindex="0"], button:not([disabled])',
        enterTo: 'first-child',
      });

      const { firstButton } = this;
      if (firstButton) {
        firstButton.focus();
        SpatialNavigation.focus(SECTION_TRANSCRIPT, firstButton);
      }
    });
  }

  @Watch('subtitleUrl')
  async onSubtitleUrlChange(url: string | null) {
    if (url === null) {
      return;
    }
    const response = await axios.get(url);
    this.vtt = response.data;
  }

  // eslint-disable-next-line class-methods-use-this
  get testCase() {
    let bigstring = '';
    for (let index = 0; index < 2000; index += 1) {
      bigstring += `yeah this is a beautiful line number ${index} dude why does this not work i'm going to defenestrate myself fr fr\n`;
    }
    return bigstring;
  }

  get subtitles() {
    let { vtt } = this;
    if (!vtt || vtt.length === 0) {
      return '';
    }
    vtt = vtt.replace(/.+ --> .+/g, '');
    vtt = vtt.replace(/<\/c>/g, '');
    vtt = vtt.replace(/<.+?>/g, '');
    vtt = vtt.replace(/^\s*$/g, '');
    vtt = vtt.replace(/&nbsp;/g, ' ');

    let lines = vtt.split('\n');
    lines.splice(0, 2);
    lines = lines.map((line) => line.trim());
    lines = lines.filter((line) => line.length > 0);
    lines = lines.filter((line, index, total) => line !== total[index + 1]);

    // TODO: solve text being cut off
    return lines.join('\n').replace(/(\.\.\.\n|\. \. \.\n|([^.])\n)/g, '$2 ');
  }
}
</script>
<style lang="scss">
.tv-transcript-dialog {
  background: linear-gradient(180deg, rgba(20, 24, 28, 0.98), rgba(13, 15, 17, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 28px;
  box-shadow: 0 32px 88px rgba(0, 0, 0, 0.6);
}

.tv-transcript-toolbar {
  min-height: 72px;
  padding-inline: 18px;
}

.tv-transcript-toolbar :deep(.v-toolbar__title) {
  font-size: 1.15rem;
}

.tv-transcript-toolbar :deep(.v-btn) {
  width: 56px;
  height: 56px;
}

.tv-transcript-toolbar :deep(.v-icon) {
  font-size: 1.5rem;
}

.tv-transcript-body :deep(.v-input__slot) {
  min-height: 420px !important;
  border-radius: 20px;
}

.tv-transcript-body :deep(textarea) {
  font-size: 1.1rem;
  line-height: 1.5;
}

@media (max-width: 959px) {
  .tv-transcript-dialog {
    border-radius: 0;
  }
}
</style>
