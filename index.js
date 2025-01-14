/* jshint unused:false */

'use strict';

var through2 = require('through2'),
  mime = require('mime'),
  gutil = require('gulp-util'),
  _ = require('lodash'),
  del = require('del'),
  fs = require('fs');

var PLUGIN_NAME = 'gulp-delete-unused-images';

function deleteUnusedImages(options) {
  options = options || {};

  _.defaults(options, { delete: true, log: false });

  var imageNames = [];
  var usedImageNames = [];

  var transform = through2.obj(function (chunk, enc, callback) {
    var self = this;

    if (chunk.isNull()) {
      self.push(chunk);
      return callback();
    }

    if (chunk.isStream()) {
      return callback(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
    }

    if (mime.lookup(chunk.path).match(/image\//)) {
      imageNames.push(chunk.path);
      return callback();
    }

    try {
      var rl = require('readline').createInterface({
        input: fs.createReadStream(String(chunk.path)),
        terminal: false,
      }).on('line', function (line) {
        // Match src, srcset, and background-image URLs
        const matches = [
          ...line.matchAll(/(?:src|srcset)="([^"]+\.(png|gif|jpe?g|svg|mng))"/gi), // Matches src and srcset
          ...line.matchAll(/url\(['"]?([^'")]+\.(png|gif|jpe?g|svg|mng))['"]?\)/gi), // Matches url(...)
        ];
        matches.forEach(match => usedImageNames.push(match[1]));
      }).on('close', function () {
        self.push(chunk);
        callback();
      });
    } catch (e) {
      console.log(e);
      callback();
    }
  });

  transform.on('finish', function () {
    _.mixin({
      findUsedImages: function (imageNames, usedImageNames) {
        return _.filter(imageNames, function (path) {
          return _.some(usedImageNames, (used) => path.endsWith(used));
        });
      },
    });

    var usedImages = _.findUsedImages(imageNames, usedImageNames);
    var unusedImages = _.difference(imageNames, usedImages);

    if (unusedImages.length) {
      if (options.delete) {
        del(unusedImages).then((paths) => {
          console.log('Deleted images:\n', paths.join('\n'));
        });
      }
      if (options.log) {
        console.log('Unused images:\n', unusedImages.join('\n'));
      }
    }
  });

  return transform;
}

module.exports = deleteUnusedImages;
