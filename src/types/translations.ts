export interface InstrumentInfo {
  title: string;
  desc: string;
  tips: string;
}

export interface TuningInfo {
  name: string;
  seoTitle: string;
  description: string;
}

export interface TranslationSchema {
  common: {
    tap_to_enable: string;
    ready: string;
    hold: string;
    listening: string;
    mic_required: string;
    flat: string;
    sharp: string;
    cents_label: string;
  };
  tuner: {
    status_idle: string;
    status_holding: string;
    status_listening: string;
  };
  instruments: {
    guitar: InstrumentInfo;
    bass: InstrumentInfo;
    ukulele: InstrumentInfo;
    cello: InstrumentInfo;
    default: InstrumentInfo;
  };
  footer: {
    frequencies_title: string;
    frequencies_ref: string;
    strings: string;
    pro_tips_title: string;
    table_string: string;
    table_note: string;
    table_freq: string;
    step_mic: string;
    step_mic_desc: string;
    step_inst: string;
    step_inst_desc_prefix: string;
    step_inst_desc_suffix: string;
    step_pluck: string;
    step_pluck_desc: string;
    step_needle: string;
    step_needle_flat: string;
    step_needle_sharp: string;
    step_diamond: string;
    step_diamond_desc: string;
  };
  tunings: Record<string, TuningInfo>;
}
