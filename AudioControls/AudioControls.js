import React, { Component } from 'react';
import {
    StyleSheet,
    View,
    Image,
    TouchableOpacity,
    Slider,
    Text,
    Dimensions
} from 'react-native';
import moment from 'moment';
import 'moment/locale/pt-br';

import images from '../config/images';
import colors from '../config/colors';
import AudioController from '../AudioController';

const { width } = Dimensions.get('window');

class AudioControls extends Component {
    static defaultProps = {
        ...Component.defaultProps,

        //SKIP SECONDS
        hasButtonSkipSeconds: false,
        timeToSkip: 15,

        //THUMBNAIL
        thumbnailSize: {
            width: width * 0.6,
            height: width * 0.6
        },

        //SOUND
        titleStyle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: colors.white
        },
        authorStyle: {
            fontSize: 16,
            color: colors.white
        },

        //COLORS
        activeColor: colors.white,
        inactiveColor: colors.grey,

        //BUTTONS
        activeButtonColor: null,
        inactiveButtonColor: null,

        //SLIDER
        sliderMinimumTrackTintColor: null,
        sliderMaximumTrackTintColor: null,
        sliderThumbTintColor: null,
        sliderTimeStyle: {
            fontSize: 18,
            color: colors.white
        }
    }

    constructor(props) {
        super(props);

        this.state = {
            duration: 0,
            currentTime: 0,
            currentAudio: {},
            isReady: true,
            isPlaying: false
        };
    }

    componentWillMount() {
        const { playlist, initialTrack } = this.props;
        AudioController.init(playlist, initialTrack, this.onChangeStatus, this.updateCurrentTime);
    }

    onChangeStatus = (status) => {
        switch (status) {
            case AudioController.status.PLAYING:
                this.setState({ isPlaying: true });
                break;
            case AudioController.status.PAUSED:
                this.setState({ isPlaying: false });
                break;
            case AudioController.status.STOPPED:
                this.setState({ isPlaying: false });
                break;
            case AudioController.status.LOADED:
                AudioController.getDuration((seconds) => {
                    this.setState({ duration: seconds });
                });
                this.setState({ currentAudio: AudioController.currentAudio });
                break;
            case AudioController.status.ERROR:
                console.log('Status Error');
                break;
            default:
                return;
        }
    }

    updateCurrentTime = (seconds) => {
        this.setState({ currentTime: seconds });
    }

    renderPlayerIcon() {
        const { isPlaying } = this.state;
        if (isPlaying) {
            return (
                <TouchableOpacity
                    onPress={() => AudioController.pause()}
                >
                    <Image
                        source={images.iconPause}
                        style={[
                            styles.playButton,
                            { tintColor: this.props.activeButtonColor || this.props.activeColor }
                        ]}
                    />
                </TouchableOpacity >
            );
        }

        return (
            <TouchableOpacity
                onPress={() => AudioController.play()}
            >
                <Image
                    source={images.iconPlay}
                    style={[
                        styles.playButton,
                        { tintColor: this.props.activeButtonColor || this.props.activeColor }
                    ]}
                />
            </TouchableOpacity >
        );
    }

    renderNextIcon() {
        if (AudioController.hasNext()) {
            return (
                <TouchableOpacity onPress={() => AudioController.playNext()}>
                    <Image
                        source={images.iconNext}
                        style={[
                            styles.controlButton,
                            { tintColor: this.props.activeButtonColor || this.props.activeColor }
                        ]}
                    />
                </TouchableOpacity>
            );
        }
        return (
            <Image
                source={images.iconNext}
                style={[
                    styles.controlButton,
                    { tintColor: this.props.inactiveButtonColor || this.props.inactiveColor }
                ]}
            />
        );
    }

    renderPreviousIcon() {
        if (AudioController.hasPrevious()) {
            return (
                <TouchableOpacity onPress={() => AudioController.playPrevious()}>
                    <Image
                        source={images.iconPrevious}
                        style={
                            [styles.controlButton,
                            { tintColor: this.props.activeButtonColor || this.props.activeColor }
                            ]}
                    />
                </TouchableOpacity>
            );
        }
        return (
            <Image
                source={images.iconPrevious}
                style={[
                    styles.controlButton,
                    { tintColor: this.props.inactiveButtonColor || this.props.inactiveColor }
                ]}
            />
        );
    }

    renderSkipbackwardIcon() {
        if (!this.props.hasButtonSkipSeconds) return;
        return (
            <TouchableOpacity
                onPress={() => {
                    AudioController.seekToForward(-this.props.timeToSkip);
                }}
            >
                <Image
                    source={images.skipBackward}
                    style={[
                        styles.controlButton,
                        { tintColor: this.props.activeButtonColor || this.props.activeColor }
                    ]}
                />
            </TouchableOpacity>
        );
    }

    renderSkipforwardIcon() {
        if (!this.props.hasButtonSkipSeconds) return;
        return (
            <TouchableOpacity
                onPress={() => {
                    AudioController.seekToForward(this.props.timeToSkip);
                }}
            >
                <Image
                    source={images.skipForward}
                    style={[styles.controlButton, { tintColor: this.props.activeButtonColor || this.props.activeColor }]}
                />
            </TouchableOpacity>
        );
    }

    render() {
        const { currentTime, duration, currentAudio } = this.state;
        return (
            <View style={styles.container}>
                <Image
                    source={currentAudio.thumbnailUri ? { uri: currentAudio.thumbnailUri } : currentAudio.thumbnailLocal}
                    style={this.props.thumbnailSize}
                />
                <View style={styles.detailContainer}>
                    <Text style={this.props.titleStyle}>{currentAudio.title}</Text>
                    <Text style={this.props.authorStyle}>{currentAudio.author}</Text>
                </View>
                <View style={styles.playbackContainer}>
                    <Text numberOfLines={1} style={this.props.sliderTimeStyle}>
                        {currentTime ? moment.utc(currentTime * 1000).format('mm:ss') : '00:00'}
                    </Text>
                    <Slider
                        value={currentTime}
                        maximumValue={duration}

                        style={styles.playbackBar}

                        minimumTrackTintColor={this.props.sliderMinimumTrackTintColor ||
                            this.props.activeColor}
                        maximumTrackTintColor={this.props.sliderMaximumTrackTintColor ||
                            this.props.inactiveColor}
                        thumbTintColor={this.props.sliderThumbTintColor || this.props.activeColor}

                        onSlidingComplete={seconds => {
                            AudioController.seek(seconds);
                            if (seconds < duration) AudioController.play();
                        }}

                        onValueChange={() => AudioController.clearCurrentTimeListener()}
                    />
                    <Text numberOfLines={1} style={this.props.sliderTimeStyle}>
                        {duration ? moment.utc(duration * 1000).format('mm:ss') : '00:00'}
                    </Text>
                </View>
                <View style={styles.buttonsContainer}>
                    {this.renderSkipbackwardIcon()}
                    {this.renderPreviousIcon()}
                    {this.renderPlayerIcon()}
                    {this.renderNextIcon()}
                    {this.renderSkipforwardIcon()}
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    },
    detailContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
        marginVertical: 10
    },
    playbackContainer: {
        flexDirection: 'row'
    },
    buttonsContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    playbackBar: {
        width: '70%'
    },
    playButton: {
        width: 80,
        height: 80
    },
    controlButton: {
        width: 20,
        height: 20,
        margin: 5
    }
});

export default AudioControls;
